-- =====================================================================
-- 0008 — Recuperar la contraseña con el número de teléfono
-- =====================================================================
-- Supabase Auth solo restablece contraseñas por correo (o por SMS, que
-- exige Twilio y que el teléfono esté en auth.users; aquí vive en
-- perfiles). La salida: con el teléfono se busca el correo de la cuenta
-- y se le envía el enlace de siempre.
--
-- Esta función NO la puede llamar el navegador: devolvería el correo de
-- cualquier persona a partir de su número. Solo la usa la Edge Function
-- recuperar-por-telefono con la service role, y esa función nunca le
-- muestra el correo al usuario.
-- =====================================================================

-- Se comparan los últimos 10 dígitos: así "+57 300 123 4567",
-- "3001234567" y "300-123-4567" son el mismo número.
create or replace function public.correos_por_telefono(p_telefono text)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text
    from perfiles p
    join auth.users u on u.id = p.id
   where u.email is not null
     and length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 7
     and right(regexp_replace(p.telefono, '\D', '', 'g'), 10)
       = right(regexp_replace(p_telefono, '\D', '', 'g'), 10);
$$;

revoke execute on function public.correos_por_telefono(text) from public, anon, authenticated;
grant  execute on function public.correos_por_telefono(text) to service_role;
