-- ═══════════════════════════════════════════════════════════════════
-- 0011_contactos_partido.sql
--
-- Contacto entre quien arma un partido y quienes se unen.
--
--  · El organizador ve el nombre y el celular de cada jugador anotado
--    en sus partidos.
--  · El jugador ve solo el nombre y el celular del organizador de los
--    partidos en los que tiene cupo. No ve a los demás jugadores.
--
-- RLS de perfiles solo deja leer el propio perfil (y al admin los de su
-- sede), así que una consulta normal no puede traer esos datos. Esta
-- función corre como `security definer` y aplica ella misma la regla:
-- solo devuelve filas donde quien consulta es una de las dos partes.
--
-- Es idempotente: se puede correr varias veces.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.contactos_mis_partidos()
returns table (
  partido_id bigint,
  tipo       text,        -- 'jugador' u 'organizador'
  usuario_id uuid,
  nombre     varchar,
  telefono   varchar,
  posicion   varchar,
  unido_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  -- Soy el organizador: los jugadores anotados en mis partidos.
  select pj.partido_id, 'jugador'::text, pf.id, pf.nombre, pf.telefono, pj.posicion, pj.unido_at
    from partidos_abiertos p
    join partido_jugadores pj on pj.partido_id = p.id
    join perfiles pf          on pf.id = pj.usuario_id
   where p.creador_id = auth.uid()
     and pj.usuario_id <> auth.uid()

  union all

  -- Soy jugador: solo el organizador de los partidos donde tengo cupo.
  select p.id, 'organizador'::text, pf.id, pf.nombre, pf.telefono, null, null
    from partido_jugadores pj
    join partidos_abiertos p on p.id = pj.partido_id
    join perfiles pf         on pf.id = p.creador_id
   where pj.usuario_id = auth.uid()
     and p.creador_id <> auth.uid()

  order by 1, 7 nulls first;
$$;

revoke execute on function public.contactos_mis_partidos() from public, anon;
grant  execute on function public.contactos_mis_partidos() to authenticated;
