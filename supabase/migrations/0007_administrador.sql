-- =====================================================================
-- 0007_administrador.sql (mismo contenido que Script.sql)
-- =====================================================================
-- Pensado para la base que YA EXISTE (ver mibasededatosactual.sql).
-- No crea tablas. Se puede ejecutar varias veces sin romper nada:
-- todo usa "create or replace", "drop ... if exists" o "if not exists".
--
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
--
-- Qué hace:
--   0. Asegura pgcrypto (para cifrar contraseñas).
--   1. Funciones auxiliares de permisos.
--   2. Reglas ON DELETE de las llaves foráneas (para poder borrar).
--   3. RLS: políticas para eliminar torneos, partidos, jugadores, equipos.
--   4. Gestión de usuarios: listar, crear, cambiar rol, eliminar.
--   5. Analítica general de todas las sedes.
--   6. Permisos de ejecución.
--   7. Convertir tu cuenta en administrador.
--   8. Consultas para verificar (comentadas).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. EXTENSIONES
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;


-- ---------------------------------------------------------------------
-- 1. FUNCIONES AUXILIARES
-- ---------------------------------------------------------------------
-- Son las mismas de 0002_rls.sql. Se vuelven a declarar por si alguna
-- no quedó creada; si ya existen, quedan igual.
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select rol from perfiles where id = auth.uid()), 'anonimo');
$$;

create or replace function public.mi_sede()
returns bigint language sql stable security definer set search_path = public as $$
  select sede_id from perfiles where id = auth.uid();
$$;

create or replace function public.administro_sede(p_sede_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid()
       and (rol = 'superadmin' or (rol = 'admin_sede' and sede_id = p_sede_id))
  );
$$;

create or replace function public.administro_cancha(p_cancha_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select administro_sede((select sede_id from canchas where id = p_cancha_id));
$$;

create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select mi_rol() = 'superadmin';
$$;


-- ---------------------------------------------------------------------
-- 2. LLAVES FORÁNEAS CON ON DELETE
-- ---------------------------------------------------------------------
-- En mibasededatosactual.sql las FK aparecen sin ON DELETE. Si de verdad
-- están así, borrar un usuario falla porque tiene partidos o reservas
-- colgando, y borrar un torneo falla por sus inscripciones.
-- Se recrean con la regla correcta (mismo nombre, mismas columnas). Cada
-- ALTER es atómico: si algo falla, la FK original se queda como estaba.
-- ---------------------------------------------------------------------

-- perfiles
alter table public.perfiles
  drop constraint if exists perfiles_id_fkey,
  add  constraint perfiles_id_fkey foreign key (id)
       references auth.users(id) on delete cascade;
alter table public.perfiles
  drop constraint if exists perfiles_sede_id_fkey,
  add  constraint perfiles_sede_id_fkey foreign key (sede_id)
       references public.sedes(id) on delete set null;

-- canchas
alter table public.canchas
  drop constraint if exists canchas_sede_id_fkey,
  add  constraint canchas_sede_id_fkey foreign key (sede_id)
       references public.sedes(id) on delete cascade;

-- reservas: si se borra el usuario, la reserva se queda (histórico de
-- ingresos) pero sin dueño.
alter table public.reservas
  drop constraint if exists reservas_cancha_id_fkey,
  add  constraint reservas_cancha_id_fkey foreign key (cancha_id)
       references public.canchas(id) on delete cascade;
alter table public.reservas
  drop constraint if exists reservas_usuario_id_fkey,
  add  constraint reservas_usuario_id_fkey foreign key (usuario_id)
       references auth.users(id) on delete set null;

-- partidos_abiertos
alter table public.partidos_abiertos
  drop constraint if exists partidos_abiertos_creador_id_fkey,
  add  constraint partidos_abiertos_creador_id_fkey foreign key (creador_id)
       references auth.users(id) on delete cascade;
alter table public.partidos_abiertos
  drop constraint if exists partidos_abiertos_cancha_id_fkey,
  add  constraint partidos_abiertos_cancha_id_fkey foreign key (cancha_id)
       references public.canchas(id) on delete cascade;
alter table public.partidos_abiertos
  drop constraint if exists partidos_abiertos_reserva_id_fkey,
  add  constraint partidos_abiertos_reserva_id_fkey foreign key (reserva_id)
       references public.reservas(id) on delete set null;

-- partido_jugadores
alter table public.partido_jugadores
  drop constraint if exists partido_jugadores_partido_id_fkey,
  add  constraint partido_jugadores_partido_id_fkey foreign key (partido_id)
       references public.partidos_abiertos(id) on delete cascade;
alter table public.partido_jugadores
  drop constraint if exists partido_jugadores_usuario_id_fkey,
  add  constraint partido_jugadores_usuario_id_fkey foreign key (usuario_id)
       references auth.users(id) on delete cascade;

-- torneos
alter table public.torneos
  drop constraint if exists torneos_sede_id_fkey,
  add  constraint torneos_sede_id_fkey foreign key (sede_id)
       references public.sedes(id) on delete cascade;
alter table public.torneos
  drop constraint if exists torneos_organizador_id_fkey,
  add  constraint torneos_organizador_id_fkey foreign key (organizador_id)
       references auth.users(id) on delete set null;

-- inscripciones_torneos
alter table public.inscripciones_torneos
  drop constraint if exists inscripciones_torneos_torneo_id_fkey,
  add  constraint inscripciones_torneos_torneo_id_fkey foreign key (torneo_id)
       references public.torneos(id) on delete cascade;
alter table public.inscripciones_torneos
  drop constraint if exists inscripciones_torneos_capitan_id_fkey,
  add  constraint inscripciones_torneos_capitan_id_fkey foreign key (capitan_id)
       references auth.users(id) on delete cascade;


-- ---------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------
-- Se asegura que RLS esté activo (si ya lo está, no cambia nada) y se
-- agregan las políticas de borrado que faltaban. Las políticas que ya
-- tienes de 0002_rls.sql (leer, crear, editar) se quedan como están.
-- ---------------------------------------------------------------------
alter table public.sedes                 enable row level security;
alter table public.perfiles              enable row level security;
alter table public.canchas               enable row level security;
alter table public.reservas              enable row level security;
alter table public.partidos_abiertos     enable row level security;
alter table public.partido_jugadores     enable row level security;
alter table public.torneos               enable row level security;
alter table public.inscripciones_torneos enable row level security;

-- El superadmin ve todos los perfiles (necesario para el panel).
drop policy if exists perfiles_ver_propio on public.perfiles;
create policy perfiles_ver_propio on public.perfiles
  for select to authenticated
  using (id = auth.uid() or administro_sede(sede_id) or mi_rol() = 'superadmin');

-- Crear torneos: admin de la sede o superadmin (igual que en 0002).
drop policy if exists torneos_crear on public.torneos;
create policy torneos_crear on public.torneos
  for insert to authenticated with check (administro_sede(sede_id));

-- Eliminar torneos. Las inscripciones se van en cascada.
drop policy if exists torneos_eliminar on public.torneos;
create policy torneos_eliminar on public.torneos
  for delete to authenticated
  using (administro_sede(sede_id));

-- Eliminar partidos: el creador el suyo, el admin cualquiera de su sede.
drop policy if exists partidos_eliminar on public.partidos_abiertos;
create policy partidos_eliminar on public.partidos_abiertos
  for delete to authenticated
  using (creador_id = auth.uid() or administro_cancha(cancha_id));

-- El admin puede sacar a un jugador de un partido.
drop policy if exists pj_sacar_admin on public.partido_jugadores;
create policy pj_sacar_admin on public.partido_jugadores
  for delete to authenticated
  using (administro_cancha((select cancha_id from partidos_abiertos where id = partido_id)));

-- El admin puede retirar un equipo de un torneo en cualquier estado.
drop policy if exists inscripciones_retirar_admin on public.inscripciones_torneos;
create policy inscripciones_retirar_admin on public.inscripciones_torneos
  for delete to authenticated
  using (administro_sede((select sede_id from torneos where id = torneo_id)));


-- ---------------------------------------------------------------------
-- 4. GESTIÓN DE USUARIOS
-- ---------------------------------------------------------------------
-- auth.users no se puede tocar desde el navegador. Estas funciones
-- corren como su dueño (postgres) y por eso sí pueden, pero lo primero
-- que hacen es exigir que quien llama sea superadmin.
-- ---------------------------------------------------------------------

-- Se borran antes porque cambiar el tipo de retorno de una función
-- existente con "create or replace" da error.
drop function if exists public.admin_listar_usuarios();
drop function if exists public.admin_crear_usuario(text, text, text, text, text, bigint);
drop function if exists public.admin_cambiar_rol(uuid, text, bigint);
drop function if exists public.admin_eliminar_usuario(uuid);
drop function if exists public.metricas_globales(date, date);

create function public.admin_listar_usuarios()
returns table (
  id uuid, correo text, nombre text, telefono text, rol text,
  sede_id bigint, sede text, creado_at timestamptz, ultimo_ingreso timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede ver los usuarios.' using errcode = 'P0006';
  end if;

  return query
    select p.id, u.email::text, p.nombre::text, p.telefono::text, p.rol::text,
           p.sede_id, s.nombre::text, p.creado_at, u.last_sign_in_at
      from perfiles p
      join auth.users u on u.id = p.id
      left join sedes s on s.id = p.sede_id
     order by p.creado_at desc;
end; $$;

-- Crea una cuenta ya confirmada (no necesita verificar el correo). El
-- trigger trg_crear_perfil le crea el perfil como jugador; si no
-- existiera, el insert de abajo lo crea igual.
create function public.admin_crear_usuario(
  p_correo   text,
  p_clave    text,
  p_nombre   text,
  p_telefono text   default null,
  p_rol      text   default 'jugador',
  p_sede_id  bigint default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id     uuid := gen_random_uuid();
  v_correo text := lower(trim(p_correo));
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede crear usuarios.' using errcode = 'P0006';
  end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'El correo no es válido.' using errcode = 'P0010';
  end if;
  if length(coalesce(p_clave, '')) < 8 then
    raise exception 'La contraseña necesita al menos 8 caracteres.' using errcode = 'P0010';
  end if;
  if coalesce(trim(p_nombre), '') = '' then
    raise exception 'El nombre es obligatorio.' using errcode = 'P0010';
  end if;
  if p_rol not in ('jugador', 'admin_sede', 'superadmin') then
    raise exception 'Rol no válido.' using errcode = 'P0010';
  end if;
  if p_rol = 'admin_sede' and p_sede_id is null then
    raise exception 'Un administrador de sede necesita una sede asignada.' using errcode = 'P0010';
  end if;
  if exists (select 1 from auth.users where email = v_correo) then
    raise exception 'Ya existe una cuenta con ese correo.' using errcode = 'P0010';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_correo, extensions.crypt(p_clave, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', trim(p_nombre), 'telefono', p_telefono),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into perfiles (id, nombre, telefono, rol, sede_id)
  values (
    v_id, trim(p_nombre), p_telefono, p_rol,
    case when p_rol = 'admin_sede' then p_sede_id end
  )
  on conflict (id) do update
     set nombre   = excluded.nombre,
         telefono = excluded.telefono,
         rol      = excluded.rol,
         sede_id  = excluded.sede_id;

  return v_id;
end; $$;

create function public.admin_cambiar_rol(
  p_usuario uuid,
  p_rol     text,
  p_sede_id bigint default null
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede cambiar roles.' using errcode = 'P0006';
  end if;
  if p_usuario = auth.uid() and p_rol <> 'superadmin' then
    raise exception 'No puedes quitarte a ti mismo el rol de administrador.' using errcode = 'P0010';
  end if;
  if p_rol not in ('jugador', 'admin_sede', 'superadmin') then
    raise exception 'Rol no válido.' using errcode = 'P0010';
  end if;
  if p_rol = 'admin_sede' and p_sede_id is null then
    raise exception 'Un administrador de sede necesita una sede asignada.' using errcode = 'P0010';
  end if;

  update perfiles
     set rol = p_rol,
         sede_id = case when p_rol = 'admin_sede' then p_sede_id end
   where id = p_usuario;

  if not found then
    raise exception 'Ese usuario no existe.' using errcode = 'P0010';
  end if;
end; $$;

-- Borra la cuenta. Perfil, partidos creados, cupos e inscripciones se
-- van en cascada; las reservas quedan sin dueño (histórico intacto).
create function public.admin_eliminar_usuario(p_usuario uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede eliminar usuarios.' using errcode = 'P0006';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta de administrador.' using errcode = 'P0010';
  end if;

  delete from auth.users where id = p_usuario;

  if not found then
    raise exception 'Ese usuario no existe.' using errcode = 'P0010';
  end if;
end; $$;


-- ---------------------------------------------------------------------
-- 5. ANALÍTICA GENERAL
-- ---------------------------------------------------------------------
-- metricas_sede() solo mira la sede propia. Esta mira todo el negocio.
-- Usa la hora de Colombia, igual que 0006_zona_horaria_colombia.sql.
-- ---------------------------------------------------------------------
create function public.metricas_globales(
  p_desde date default (current_date - 30),
  p_hasta date default current_date
)
returns json
language plpgsql stable security definer
set search_path = public
set timezone = 'America/Bogota'
as $$
declare v_res json;
begin
  if not es_superadmin() then
    raise exception 'Solo el administrador puede ver la analítica general.' using errcode = 'P0006';
  end if;

  with rango as (
    select r.*, c.nombre as cancha, c.sede_id
      from reservas r join canchas c on c.id = r.cancha_id
     where r.fecha between p_desde and p_hasta
  ),
  validas as (
    select * from rango where estado in ('confirmada', 'completada')
  )
  select json_build_object(
    'desde', p_desde,
    'hasta', p_hasta,

    'resumen', json_build_object(
      'reservas',          (select count(*) from validas),
      'canceladas',        (select count(*) from rango where estado = 'cancelada'),
      'ingresos',          (select coalesce(sum(precio_total), 0) from validas),
      'reservas_hoy',      (select count(*) from reservas
                             where fecha = current_date and estado in ('confirmada', 'pendiente')),
      'usuarios',          (select count(*) from perfiles),
      'usuarios_nuevos',   (select count(*) from perfiles
                             where creado_at::date between p_desde and p_hasta),
      'partidos_abiertos', (select count(*) from partidos_abiertos
                             where estado = 'abierto' and fecha >= current_date),
      'torneos_activos',   (select count(*) from torneos
                             where estado in ('inscripciones', 'cerrado', 'en_curso'))
    ),

    'usuarios_por_rol', (
      select coalesce(json_object_agg(rol, n), '{}'::json)
        from (select rol, count(*) as n from perfiles group by rol) x
    ),

    'por_sede', (
      select coalesce(json_agg(x order by x.ingresos desc), '[]'::json)
        from (
          select s.id, s.nombre,
                 count(v.id) as reservas,
                 coalesce(sum(v.precio_total), 0) as ingresos,
                 (select count(*) from canchas c where c.sede_id = s.id and c.activa) as canchas
            from sedes s
            left join validas v on v.sede_id = s.id
           group by s.id, s.nombre
        ) x
    ),

    'reservas_por_dia', (
      select coalesce(json_agg(x order by x.fecha), '[]'::json)
        from (
          select d::date as fecha,
                 count(v.id) as reservas,
                 coalesce(sum(v.precio_total), 0) as ingresos
            from generate_series(p_desde, p_hasta, interval '1 day') as d
            left join validas v on v.fecha = d::date
           group by d
        ) x
    ),

    'top_canchas', (
      select coalesce(json_agg(x), '[]'::json)
        from (
          select v.cancha, s.nombre as sede,
                 count(*) as reservas,
                 sum(v.precio_total) as ingresos
            from validas v join sedes s on s.id = v.sede_id
           group by v.cancha, s.nombre
           order by count(*) desc
           limit 5
        ) x
    )
  ) into v_res;

  return v_res;
end; $$;


-- ---------------------------------------------------------------------
-- 6. PERMISOS DE EJECUCIÓN
-- ---------------------------------------------------------------------
-- Postgres deja ejecutar cualquier función a PUBLIC por defecto. A las
-- de administración se les quita y se les da solo a usuarios con sesión.
-- Adentro, cada una vuelve a exigir el rol superadmin.
-- ---------------------------------------------------------------------
revoke execute on function public.admin_listar_usuarios()                                    from public, anon;
revoke execute on function public.admin_crear_usuario(text, text, text, text, text, bigint)  from public, anon;
revoke execute on function public.admin_cambiar_rol(uuid, text, bigint)                      from public, anon;
revoke execute on function public.admin_eliminar_usuario(uuid)                               from public, anon;
revoke execute on function public.metricas_globales(date, date)                              from public, anon;

grant execute on function public.es_superadmin()                                             to authenticated;
grant execute on function public.admin_listar_usuarios()                                     to authenticated;
grant execute on function public.admin_crear_usuario(text, text, text, text, text, bigint)   to authenticated;
grant execute on function public.admin_cambiar_rol(uuid, text, bigint)                       to authenticated;
grant execute on function public.admin_eliminar_usuario(uuid)                                to authenticated;
grant execute on function public.metricas_globales(date, date)                               to authenticated;


-- ---------------------------------------------------------------------
-- 7. TU CUENTA DE ADMINISTRADOR
-- ---------------------------------------------------------------------
-- Antes de correr el script:
--   a) Crea la cuenta: regístrate en la app, o en Supabase →
--      Authentication → Users → Add user (marca "Auto Confirm User").
--   b) Cambia el correo de abajo por el de esa cuenta.
-- Si el correo no existe, no pasa nada: actualiza cero filas.
-- ---------------------------------------------------------------------
-- Si el perfil no existe (usuario creado desde el panel de Supabase),
-- se crea; si ya existe, solo se le cambia el rol.
insert into public.perfiles (id, nombre, rol, sede_id)
select id, coalesce(raw_user_meta_data->>'nombre', 'Administrador'), 'superadmin', null
  from auth.users
 where email = lower('administrador@gmail.com')
on conflict (id) do update
   set rol = 'superadmin', sede_id = null;


-- ---------------------------------------------------------------------
-- 8. VERIFICACIÓN  (quita los "--" y ejecútalas aparte si quieres)
-- ---------------------------------------------------------------------
-- ¿Quién es superadmin?
--   select u.email, p.nombre, p.rol
--     from perfiles p join auth.users u on u.id = p.id
--    where p.rol = 'superadmin';
--
-- ¿Las FK quedaron con ON DELETE? (debe decir CASCADE / SET NULL)
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where contype = 'f' and connamespace = 'public'::regnamespace
--    order by conrelid::regclass::text;
--
-- ¿Qué políticas RLS hay?
--   select tablename, policyname, cmd
--     from pg_policies where schemaname = 'public'
--    order by tablename, cmd;
