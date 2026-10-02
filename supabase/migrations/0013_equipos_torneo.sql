-- ═══════════════════════════════════════════════════════════════════
-- 0013_equipos_torneo.sql
--
-- Equipos inscritos en un torneo, con los datos de contacto de su
-- capitán (quien inscribió al equipo): nombre, celular y correo.
--
-- Solo los ve quien administra la sede del torneo: el admin de esa
-- sede o el superadmin. RLS de perfiles no deja leer el perfil de los
-- capitanes, y el correo vive en auth.users, así que la función corre
-- como `security definer` y revisa el permiso ella misma.
--
-- Es idempotente. Cómo correrlo: Supabase → SQL Editor → pegar → Run.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.equipos_torneo(p_torneo_id bigint)
returns table (
  inscripcion_id bigint,
  nombre_equipo  varchar,
  capitan_id     uuid,
  capitan_nombre varchar,
  telefono       varchar,
  correo         varchar,
  inscrito_at    timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sede bigint;
begin
  select sede_id into v_sede from torneos where id = p_torneo_id;
  if not found then
    raise exception 'Ese torneo no existe.' using errcode = 'P0002';
  end if;
  if not administro_sede(v_sede) then
    raise exception 'Solo el administrador de la sede puede ver los equipos inscritos.' using errcode = 'P0006';
  end if;

  return query
    select i.id,
           i.nombre_equipo,
           i.capitan_id,
           pf.nombre,
           pf.telefono,
           u.email::varchar,
           i.creado_at
      from inscripciones_torneos i
      left join perfiles   pf on pf.id = i.capitan_id
      left join auth.users u  on u.id  = i.capitan_id
     where i.torneo_id = p_torneo_id
     order by i.creado_at;
end; $$;

revoke execute on function public.equipos_torneo(bigint) from public, anon;
grant  execute on function public.equipos_torneo(bigint) to authenticated;
