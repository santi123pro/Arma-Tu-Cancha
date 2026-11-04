-- =====================================================================
-- 0020 — Corrige datos de canchas y sedes
-- =====================================================================
--  · Una cancha quedó como "Futbol 6", sin tilde.
--  · Bernabéu cierra a las 23:00. Con 23:59 mostraba un horario raro,
--    pero ofrecía las mismas franjas: la última sigue siendo la de las
--    22:00, que termina a las 23:00.
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

update public.canchas set tipo = 'Fútbol 6' where tipo = 'Futbol 6';

update public.sedes set hora_cierre = '23:00' where slug = 'bernabeu' and hora_cierre = '23:59';
