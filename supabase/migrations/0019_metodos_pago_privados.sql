-- =====================================================================
-- 0019 — Los medios de pago solo se leen con sesión iniciada
-- =====================================================================
-- sede_metodos_pago guarda el titular y la cuenta de cada sede. Hasta
-- ahora cualquiera podía leerlos con la clave pública, sin cuenta.
-- El jugador solo los necesita en la pasarela, y para llegar ahí ya
-- tiene sesión. Las funciones de reserva y pago son security definer:
-- no dependen de este permiso.
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

drop policy if exists sede_metodos_pago_lectura on public.sede_metodos_pago;
create policy sede_metodos_pago_lectura on public.sede_metodos_pago
  for select to authenticated
  using (activo or public.administro_sede(sede_id));

revoke select on public.sede_metodos_pago from anon;
