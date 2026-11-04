-- =====================================================================
-- 0019 — Datos de cobro solo para usuarios con sesión
-- =====================================================================
-- Antes, titular y cuenta (Nequi/Bre-B) de cada sede se podían leer sin
-- iniciar sesión. La pasarela solo se abre después de reservar, así que
-- el jugador siempre tiene sesión cuando los necesita.
-- Aplicada en producción el 2026-11-04.
-- =====================================================================

drop policy if exists sede_metodos_pago_lectura on public.sede_metodos_pago;
create policy sede_metodos_pago_lectura on public.sede_metodos_pago
  for select to authenticated
  using (activo or public.administro_sede(sede_id));

revoke select on public.sede_metodos_pago from anon;
