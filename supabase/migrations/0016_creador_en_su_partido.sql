-- =====================================================================
-- 0016 — Quien arma un partido queda anotado en él
-- =====================================================================
-- Antes, quien publicaba un partido tenía que tocar "Tomar un cupo yo
-- también" para aparecer en la lista. Ahora:
--
--  · Al crear el partido, el creador ocupa un cupo automáticamente.
--  · El creador no puede salirse de su propio partido (si no va, que
--    lo cancele).
--  · Los partidos abiertos que ya existen anotan a su creador si queda
--    cupo.
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

-- Corre como dueño de la tabla: la política pj_unirse no aplica aquí.
create or replace function public.fn_anotar_creador_partido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into partido_jugadores (partido_id, usuario_id, posicion)
  values (new.id, new.creador_id, null)
  on conflict (partido_id, usuario_id) do nothing;
  return null;
end;
$$;

drop trigger if exists trg_anotar_creador_partido on public.partidos_abiertos;
create trigger trg_anotar_creador_partido
  after insert on public.partidos_abiertos
  for each row execute function public.fn_anotar_creador_partido();

-- El creador no se sale de su partido; los demás sí.
drop policy if exists pj_salirse on public.partido_jugadores;
create policy pj_salirse on public.partido_jugadores
  for delete to authenticated
  using (
    usuario_id = auth.uid()
    and not exists (
      select 1 from partidos_abiertos p
       where p.id = partido_id
         and p.creador_id = auth.uid()
    )
  );

-- Partidos que ya existen: anota al creador donde todavía hay cupo.
insert into public.partido_jugadores (partido_id, usuario_id, posicion)
select p.id, p.creador_id, null
  from public.partidos_abiertos p
 where p.estado = 'abierto'
   and p.cupos_ocupados < p.cupos_totales
   and (p.fecha + p.hora_inicio) > (now() at time zone 'America/Bogota')
on conflict (partido_id, usuario_id) do nothing;
