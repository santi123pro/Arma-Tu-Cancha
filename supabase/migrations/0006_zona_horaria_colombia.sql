-- ═══════════════════════════════════════════════════════════════
-- 0006_zona_horaria_colombia.sql
--
-- Supabase corre en UTC, así que current_date, current_time y la
-- conversión de (fecha + hora) a instante usaban la hora de Londres,
-- no la de Cali. Desde las 7 p. m. de Colombia (medianoche UTC),
-- current_date ya es "mañana" y crear_reserva rechazaba las reservas
-- del mismo día con "No puedes reservar en una fecha que ya pasó".
-- Por la misma razón disponibilidad_cancha marcaba mal las franjas de
-- hoy, y cancelar_reserva calculaba las 24 horas con 5 horas de error.
--
-- Se fija la zona horaria dentro de cada función. Así no depende de
-- la configuración de la base ni de la conexión que haga la llamada.
-- ═══════════════════════════════════════════════════════════════

alter function public.crear_reserva(
  bigint, date, time, int, varchar, varchar, varchar, varchar, text
) set timezone = 'America/Bogota';

alter function public.cancelar_reserva(bigint)
  set timezone = 'America/Bogota';

alter function public.disponibilidad_cancha(bigint, date)
  set timezone = 'America/Bogota';

alter function public.metricas_sede(date, date)
  set timezone = 'America/Bogota';

alter function public.ocupacion_por_cancha(date, date)
  set timezone = 'America/Bogota';

alter function public.zonas_muertas(int)
  set timezone = 'America/Bogota';
