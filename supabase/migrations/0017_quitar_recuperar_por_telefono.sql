-- =====================================================================
-- 0017 — Quitar la recuperación de contraseña por teléfono
-- =====================================================================
-- La contraseña se recupera solo por correo. Se borra la función de
-- 0008 que buscaba el correo de una cuenta a partir del teléfono (la
-- usaba la Edge Function recuperar-por-telefono, que también se quitó).
--
-- El teléfono sigue en perfiles: lo usan los contactos de partidos y
-- torneos.
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

drop function if exists public.correos_por_telefono(text);
