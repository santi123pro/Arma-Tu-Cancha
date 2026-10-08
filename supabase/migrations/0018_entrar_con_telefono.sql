-- =====================================================================
-- 0018 — Iniciar sesión con el celular (además del correo)
-- =====================================================================
-- Supabase Auth solo entra con correo y contraseña, y el celular vive
-- en perfiles. La Edge Function entrar-con-telefono busca aquí el correo
-- de la cuenta, inicia sesión por el jugador y le devuelve la sesión.
-- El correo nunca llega al navegador.
--
--  · cuentas_por_telefono(): solo la service role puede llamarla.
--  · intentos_login_telefono: 5 contraseñas malas para un número lo
--    bloquean 15 minutos (exista o no la cuenta, para no revelarlo).
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

create table if not exists public.intentos_login_telefono (
  id         bigint generated always as identity primary key,
  -- Últimos 10 dígitos del celular.
  telefono   varchar(10)  not null,
  exito      boolean      not null default false,
  creado_at  timestamptz  not null default now()
);

create index if not exists intentos_login_telefono_idx
  on public.intentos_login_telefono (telefono, creado_at desc);

-- Sin políticas: solo la service role de la Edge Function la usa.
alter table public.intentos_login_telefono enable row level security;
revoke all on public.intentos_login_telefono from anon, authenticated;

-- Correos de las cuentas con ese celular, de la más nueva a la más vieja.
-- Se comparan los últimos 10 dígitos: "+57 300 123 4567", "3001234567"
-- y "300-123-4567" son el mismo número.
create or replace function public.cuentas_por_telefono(p_telefono text)
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
     and length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 10
     and right(regexp_replace(p.telefono, '\D', '', 'g'), 10)
       = right(regexp_replace(p_telefono, '\D', '', 'g'), 10)
   order by p.creado_at desc
   limit 3;
$$;

revoke execute on function public.cuentas_por_telefono(text) from public, anon, authenticated;
grant  execute on function public.cuentas_por_telefono(text) to service_role;
