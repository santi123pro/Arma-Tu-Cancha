-- ═══════════════════════════════════════════════════════════════
-- 0005_partidos_sin_solape.sql
--
-- Impide publicar dos partidos en la misma cancha, el mismo día y a
-- la misma hora. Es la misma idea que reservas_sin_solape: un índice
-- único parcial que ningún cliente puede saltarse, ni siquiera con
-- dos usuarios publicando al mismo tiempo.
--
-- Los partidos cancelados no bloquean el horario.
-- ═══════════════════════════════════════════════════════════════

-- Si ya hay duplicados (creados antes de esta regla), el índice no se
-- podría crear. Se conserva el partido más antiguo de cada franja y
-- los demás pasan a 'cancelado'; no se borra ninguna fila.
update public.partidos_abiertos p
   set estado = 'cancelado'
 where p.estado <> 'cancelado'
   and exists (
     select 1 from public.partidos_abiertos o
      where o.cancha_id   = p.cancha_id
        and o.fecha       = p.fecha
        and o.hora_inicio = p.hora_inicio
        and o.estado     <> 'cancelado'
        and o.id          < p.id
   );

drop index if exists public.partidos_sin_solape;
create unique index partidos_sin_solape
  on public.partidos_abiertos (cancha_id, fecha, hora_inicio)
  where estado <> 'cancelado';
