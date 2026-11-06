-- =====================================================================
-- 0024_perfil_jugador.sql
--
-- Perfil del jugador, en "Mi cuenta":
--   · Foto (bucket público 'avatars', carpeta = id del usuario).
--   · Estado: disponible u ocupado, con un texto opcional.
--   · Tipo de jugador: posición, nivel y pie hábil.
--   · Ubicación: barrio o dirección, texto libre.
--   · Privacidad: si muestra su celular, su foto y su ubicación a la gente
--     de sus partidos.
--
-- contactos_mis_partidos() (0011) ahora respeta esa privacidad y devuelve
-- el perfil. Cada quien edita su perfil con perfiles_editar_propio (0023),
-- que no deja tocar rol, sede ni mfa_obligatorio.
--
-- Es idempotente. Supabase → SQL Editor → pegar → Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLUMNAS
-- ---------------------------------------------------------------------
alter table public.perfiles
  add column if not exists foto_url          text,
  add column if not exists estado            text not null default 'disponible',
  add column if not exists estado_texto      varchar(80),
  add column if not exists posicion          text,
  add column if not exists nivel             text,
  add column if not exists pie               text,
  add column if not exists ubicacion         varchar(150),
  add column if not exists mostrar_telefono  boolean not null default true,
  add column if not exists mostrar_foto      boolean not null default true,
  add column if not exists mostrar_ubicacion boolean not null default false;

alter table public.perfiles drop constraint if exists perfiles_estado_valido;
alter table public.perfiles add constraint perfiles_estado_valido
  check (estado in ('disponible', 'ocupado'));

alter table public.perfiles drop constraint if exists perfiles_posicion_valida;
alter table public.perfiles add constraint perfiles_posicion_valida
  check (posicion is null or posicion in ('portero', 'defensa', 'medio', 'delantero'));

alter table public.perfiles drop constraint if exists perfiles_nivel_valido;
alter table public.perfiles add constraint perfiles_nivel_valido
  check (nivel is null or nivel in ('recreativo', 'intermedio', 'competitivo'));

alter table public.perfiles drop constraint if exists perfiles_pie_valido;
alter table public.perfiles add constraint perfiles_pie_valido
  check (pie is null or pie in ('derecho', 'izquierdo', 'ambos'));

-- ---------------------------------------------------------------------
-- 2. FOTOS: bucket 'avatars'
-- ---------------------------------------------------------------------
-- Público para poder mostrarlas con una URL normal. La ruta lleva un
-- nombre al azar, y si el jugador oculta su foto la URL no se comparte.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Cada quien sube y borra solo dentro de su carpeta: avatars/<su id>/...
drop policy if exists avatars_subir on storage.objects;
create policy avatars_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists avatars_borrar on storage.objects;
create policy avatars_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 3. CONTACTOS DE PARTIDOS CON PERFIL Y PRIVACIDAD
-- ---------------------------------------------------------------------
-- Cambia el tipo de retorno: se borra y se vuelve a crear.
-- `posicion` sigue siendo la del cupo en ese partido.
drop function if exists public.contactos_mis_partidos();

create function public.contactos_mis_partidos()
returns table (
  partido_id   bigint,
  tipo         text,        -- 'jugador' u 'organizador'
  usuario_id   uuid,
  nombre       varchar,
  telefono     varchar,
  posicion     varchar,
  unido_at     timestamptz,
  foto_url     text,
  estado       text,
  estado_texto varchar,
  nivel        text,
  ubicacion    varchar
)
language sql stable security definer set search_path = public as $$
  -- Soy el organizador: los jugadores anotados en mis partidos.
  select pj.partido_id, 'jugador'::text, pf.id, pf.nombre,
         case when pf.mostrar_telefono then pf.telefono end,
         pj.posicion, pj.unido_at,
         case when pf.mostrar_foto then pf.foto_url end,
         pf.estado, pf.estado_texto, pf.nivel,
         case when pf.mostrar_ubicacion then pf.ubicacion end
    from partidos_abiertos p
    join partido_jugadores pj on pj.partido_id = p.id
    join perfiles pf          on pf.id = pj.usuario_id
   where p.creador_id = auth.uid()
     and pj.usuario_id <> auth.uid()

  union all

  -- Soy jugador: solo el organizador de los partidos donde tengo cupo.
  select p.id, 'organizador'::text, pf.id, pf.nombre,
         case when pf.mostrar_telefono then pf.telefono end,
         null, null,
         case when pf.mostrar_foto then pf.foto_url end,
         pf.estado, pf.estado_texto, pf.nivel,
         case when pf.mostrar_ubicacion then pf.ubicacion end
    from partido_jugadores pj
    join partidos_abiertos p on p.id = pj.partido_id
    join perfiles pf         on pf.id = p.creador_id
   where pj.usuario_id = auth.uid()
     and p.creador_id <> auth.uid()

  order by 1, 7 nulls first;
$$;

revoke execute on function public.contactos_mis_partidos() from public, anon;
grant  execute on function public.contactos_mis_partidos() to authenticated;
