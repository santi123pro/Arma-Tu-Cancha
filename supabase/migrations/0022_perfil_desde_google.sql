-- =====================================================================
-- 0022 — Perfil con el nombre y la foto de Google
-- =====================================================================
-- Cuando la cuenta se crea con "Continuar con Google", Google envía el
-- nombre en full_name/name y la foto en avatar_url/picture. Con correo y
-- contraseña todo sigue igual (nombre y telefono del formulario).
-- Aplicada en producción el 2026-11-06.
-- =====================================================================

create or replace function public.fn_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.perfiles (id, nombre, telefono, rol, foto_url)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'nombre'), ''),
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'telefono',
    'jugador',
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;

revoke execute on function public.fn_crear_perfil() from public, anon, authenticated;
