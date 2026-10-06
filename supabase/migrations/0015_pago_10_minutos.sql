-- ═══════════════════════════════════════════════════════════════════
-- 0015_pago_10_minutos.sql
--
-- Tiempos del pago con QR:
--   · El jugador tiene 10 minutos para pagar y enviar el comprobante.
--     Si no lo hace, la reserva se cancela y el horario se libera.
--   · La sede tiene 30 minutos para confirmar cada comprobante (lo
--     muestra el panel; una reserva ya pagada nunca se cancela sola).
--
-- Antes la limpieza de las vencidas pasaba solo "cuando alguien
-- entraba". Ahora pg_cron la corre cada minuto.
--
-- Requiere 0014. Es idempotente. Supabase → SQL Editor → pegar → Run.
-- ═══════════════════════════════════════════════════════════════════

alter table public.sedes alter column pago_minutos_limite set default 10;
update public.sedes set pago_minutos_limite = 10 where pago_minutos_limite <> 10;

create extension if not exists pg_cron;

-- Reprograma el job si ya existía.
select cron.unschedule(jobid) from cron.job where jobname = 'liberar-reservas-vencidas';
select cron.schedule('liberar-reservas-vencidas', '* * * * *', 'select public.liberar_reservas_vencidas()');
