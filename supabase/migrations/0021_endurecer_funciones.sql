-- =====================================================================
-- 0021 — Permisos de funciones (avisos de seguridad de Supabase)
-- =====================================================================
-- No cambia el comportamiento de la app:
--  · las funciones de trigger y el cron no se llaman por la API;
--  · métricas, cancelar y registrar resultado ya exigían sesión.
-- Se dejan públicas las que usa la app o las políticas RLS
-- (disponibilidad_cancha, crear_reserva, mi_rol, mi_sede, administro_*,
-- puedo_*_comprobante, registrar_establecimiento).
-- Aplicada en producción el 2026-11-04.
-- =====================================================================

alter function public.fn_generar_codigo(text) set search_path = public;
alter function public.carpeta_id(text) set search_path = public;

revoke execute on function public.fn_anotar_creador_partido() from public, anon, authenticated;
revoke execute on function public.fn_crear_perfil()           from public, anon, authenticated;
revoke execute on function public.fn_solicitud_sin_repetir()  from public, anon, authenticated;
revoke execute on function public.fn_sync_cupos_partido()     from public, anon, authenticated;
revoke execute on function public.fn_sync_cupos_torneo()      from public, anon, authenticated;

revoke execute on function public.liberar_reservas_vencidas() from public, anon, authenticated;

revoke execute on function public.cancelar_reserva(bigint)              from public, anon;
revoke execute on function public.metricas_sede(date, date)             from public, anon;
revoke execute on function public.ocupacion_por_cancha(date, date)      from public, anon;
revoke execute on function public.zonas_muertas(integer)                from public, anon;
revoke execute on function public.registrar_resultado(bigint, bigint, integer, integer) from public, anon;
grant  execute on function public.cancelar_reserva(bigint)              to authenticated;
grant  execute on function public.metricas_sede(date, date)             to authenticated;
grant  execute on function public.ocupacion_por_cancha(date, date)      to authenticated;
grant  execute on function public.zonas_muertas(integer)                to authenticated;
grant  execute on function public.registrar_resultado(bigint, bigint, integer, integer) to authenticated;
