-- =====================================================================
-- 0023_mfa_obligatorio.sql
--
-- Verificación en dos pasos (TOTP) exigida por el superadmin, cuenta por
-- cuenta, como en Entra ID:
--
--   1. perfiles.mfa_obligatorio: lo marca solo el superadmin.
--   2. Una cuenta marcada que no escribió el código (sesión aal1) se trata
--      como jugador: mi_rol() y administro_sede() le niegan lo de admin.
--      Así no basta con robar la contraseña, aunque se salten la app.
--   3. admin_listar_usuarios devuelve si la tiene exigida y si ya la activó.
--   4. admin_exigir_mfa y admin_restablecer_mfa (perdió el celular).
--
-- Las cuentas sin marcar siguen igual: la verificación es opcional.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLUMNA
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists mfa_obligatorio boolean not null default false;

-- El dueño del perfil no puede quitarse la marca.
drop policy if exists perfiles_editar_propio on public.perfiles;
create policy perfiles_editar_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = (select rol from perfiles where id = auth.uid())
    and sede_id is not distinct from (select sede_id from perfiles where id = auth.uid())
    and mfa_obligatorio = (select mfa_obligatorio from perfiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- 2. PERMISOS SEGÚN EL NIVEL DE LA SESIÓN
-- ---------------------------------------------------------------------
-- true si la cuenta no tiene la verificación exigida, o si esta sesión ya
-- escribió el código (claim aal = aal2 del JWT).
create or replace function public.mfa_al_dia()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select not mfa_obligatorio or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
       from perfiles where id = auth.uid()),
    true
  );
$$;

-- Admin sin el código → jugador. es_superadmin() usa esta función.
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when mfa_al_dia() then rol else 'jugador' end
       from perfiles where id = auth.uid()),
    'anonimo'
  );
$$;

create or replace function public.administro_sede(p_sede_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select mfa_al_dia() and exists (
    select 1 from perfiles
     where id = auth.uid()
       and (rol = 'superadmin' or (rol = 'admin_sede' and sede_id = p_sede_id))
  );
$$;

-- mi_sede() la usan las métricas del admin de sede junto con mi_rol(),
-- que ya lo frena. No hace falta tocarla.

revoke execute on function public.mfa_al_dia() from public, anon;
grant  execute on function public.mfa_al_dia() to authenticated;

-- ---------------------------------------------------------------------
-- 3. LISTADO DE USUARIOS CON EL ESTADO DE LA VERIFICACIÓN
-- ---------------------------------------------------------------------
-- Cambia el tipo de retorno: hay que borrarla y volver a darle permisos.
drop function if exists public.admin_listar_usuarios();

create function public.admin_listar_usuarios()
returns table (
  id uuid, correo text, nombre text, telefono text, rol text,
  sede_id bigint, sede text, creado_at timestamptz, ultimo_ingreso timestamptz,
  mfa_obligatorio boolean, mfa_activo boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede ver los usuarios.' using errcode = 'P0006';
  end if;

  return query
    select p.id, u.email::text, p.nombre::text, p.telefono::text, p.rol::text,
           p.sede_id, s.nombre::text, p.creado_at, u.last_sign_in_at,
           p.mfa_obligatorio,
           exists (select 1 from auth.mfa_factors f
                    where f.user_id = p.id and f.factor_type = 'totp' and f.status = 'verified')
      from perfiles p
      join auth.users u on u.id = p.id
      left join sedes s on s.id = p.sede_id
     order by p.creado_at desc;
end; $$;

revoke execute on function public.admin_listar_usuarios() from public, anon;
grant  execute on function public.admin_listar_usuarios() to authenticated;

-- ---------------------------------------------------------------------
-- 4. EXIGIR Y RESTABLECER
-- ---------------------------------------------------------------------
create or replace function public.admin_exigir_mfa(p_usuario uuid, p_exigir boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede exigir la verificación.' using errcode = 'P0006';
  end if;

  update perfiles set mfa_obligatorio = coalesce(p_exigir, false) where id = p_usuario;
  if not found then
    raise exception 'Ese usuario no existe.' using errcode = 'P0002';
  end if;
end; $$;

-- Para quien perdió el celular: borra su app autenticadora. Si la tiene
-- exigida, al entrar de nuevo le pedirá activarla otra vez.
create or replace function public.admin_restablecer_mfa(p_usuario uuid)
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede restablecer la verificación.' using errcode = 'P0006';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes restablecer tu propia verificación.' using errcode = 'P0006';
  end if;

  delete from auth.mfa_factors where user_id = p_usuario;
end; $$;

revoke execute on function public.admin_exigir_mfa(uuid, boolean) from public, anon;
revoke execute on function public.admin_restablecer_mfa(uuid)     from public, anon;
grant  execute on function public.admin_exigir_mfa(uuid, boolean) to authenticated;
grant  execute on function public.admin_restablecer_mfa(uuid)     to authenticated;
