-- =====================================================================
-- 0020 — Corrección de datos y vista de posiciones
-- =====================================================================
-- Aplicada en producción el 2026-11-04.
-- =====================================================================

-- Un solo nombre para el tipo de cancha.
update public.canchas set tipo = 'Fútbol 6' where tipo = 'Futbol 6';

-- Bernabéu cerraba a las 23:59: la última franja quedaba de 23:00 a 23:59.
update public.sedes set hora_cierre = '23:00' where slug = 'bernabeu' and hora_cierre = '23:59';

-- La tabla de posiciones respeta los permisos de quien consulta
-- (aviso "Security Definer View" de Supabase).
alter view public.v_tabla_torneo set (security_invoker = on);
