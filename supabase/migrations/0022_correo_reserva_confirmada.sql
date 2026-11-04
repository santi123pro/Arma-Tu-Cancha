-- =====================================================================
-- 0022 — Correo de "reserva confirmada"
-- =====================================================================
-- Cuando una reserva pasa de pendiente a confirmada, un trigger guarda
-- el aviso en la cola correos_reserva. pg_cron llama cada minuto a la
-- Edge Function enviar-correos-reserva, que lo envía y reintenta si falla.
-- Un fallo aquí nunca impide aprobar un pago.
--
-- Antes de que el envío funcione, crea en Vault (fuera del repo):
--   correos_funcion_url    URL de la Edge Function
--   correos_funcion_token  mismo valor que el secreto CORREOS_TOKEN
--
-- Prueba: supabase/pruebas/0022_correos.sql
-- =====================================================================

create extension if not exists pg_net;

create table if not exists public.correos_reserva (
  id                 bigint generated always as identity primary key,
  reserva_id         bigint      not null unique references public.reservas(id) on delete cascade,
  estado             varchar(10) not null default 'pendiente',
  intentos           int         not null default 0,
  proximo_intento_at timestamptz not null default now(),
  bloqueado_hasta    timestamptz,
  ultimo_error       text,
  creado_at          timestamptz not null default now(),
  enviado_at         timestamptz,

  constraint correos_reserva_estado_valido check (
    estado in ('pendiente', 'enviando', 'enviado', 'fallido', 'omitido')
  )
);

create index if not exists correos_reserva_por_enviar
  on public.correos_reserva (proximo_intento_at)
  where estado in ('pendiente', 'enviando');

-- Sin políticas: solo se usa desde las funciones de abajo.
alter table public.correos_reserva enable row level security;
revoke all on table public.correos_reserva from public, anon, authenticated;


-- ---------------------------------------------------------------------
-- Trigger: encola el aviso. Cualquier error se registra y no se propaga,
-- para que nunca bloquee la aprobación del pago.
-- ---------------------------------------------------------------------
create or replace function public.fn_encolar_correo_reserva()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into correos_reserva (reserva_id) values (new.id)
  on conflict (reserva_id) do nothing;
  return new;
exception when others then
  raise warning 'No se pudo encolar el correo de la reserva %: %', new.id, sqlstate;
  return new;
end; $$;

drop trigger if exists trg_encolar_correo_reserva on public.reservas;
create trigger trg_encolar_correo_reserva
  after update of estado on public.reservas
  for each row
  when (old.estado = 'pendiente' and new.estado = 'confirmada')
  execute function public.fn_encolar_correo_reserva();


-- ---------------------------------------------------------------------
-- Toma los correos listos para enviar. skip locked evita que dos
-- ejecuciones tomen la misma fila. Una fila "enviando" con el bloqueo
-- vencido quedó abandonada (la función se cayó) y se vuelve a tomar.
-- ---------------------------------------------------------------------
create or replace function public.tomar_correos_reserva(p_limite int default 10)
returns table (
  id bigint, reserva_id bigint, destinatario text, nombre text, codigo text,
  sede text, cancha text, fecha date, hora_inicio time, hora_fin time, precio_total int
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  update correos_reserva c
     set estado = 'fallido',
         bloqueado_hasta = null,
         ultimo_error = coalesce(c.ultimo_error, 'Se agotaron los intentos.')
   where c.estado = 'enviando' and c.bloqueado_hasta < now() and c.intentos >= 5;

  -- Ya no hay a quién avisar: se canceló o la cuenta no existe.
  update correos_reserva c
     set estado = 'omitido', bloqueado_hasta = null
    from reservas r
    left join auth.users u on u.id = r.usuario_id
   where r.id = c.reserva_id
     and (c.estado = 'pendiente' or (c.estado = 'enviando' and c.bloqueado_hasta < now()))
     and (r.estado <> 'confirmada' or u.email is null);

  return query
  with tomadas as (
    select c.id
      from correos_reserva c
     where (c.estado = 'pendiente' and c.proximo_intento_at <= now())
        or (c.estado = 'enviando' and c.bloqueado_hasta < now())
     order by c.proximo_intento_at
     limit p_limite
     for update skip locked
  ), marcadas as (
    update correos_reserva c
       set estado = 'enviando',
           intentos = c.intentos + 1,
           bloqueado_hasta = now() + interval '5 minutes'
      from tomadas t
     where c.id = t.id
    returning c.id, c.reserva_id
  )
  select m.id, m.reserva_id, u.email::text, r.cliente_nombre::text, r.codigo::text,
         s.nombre::text, ca.nombre::text, r.fecha, r.hora_inicio, r.hora_fin, r.precio_total
    from marcadas m
    join reservas r on r.id = m.reserva_id
    join canchas ca on ca.id = r.cancha_id
    join sedes s on s.id = ca.sede_id
    join auth.users u on u.id = r.usuario_id;
end; $$;


-- ---------------------------------------------------------------------
-- Guarda el resultado. Tras un fallo espera 1, 5, 15 y 60 minutos; el
-- quinto fallo es definitivo.
-- ---------------------------------------------------------------------
create or replace function public.marcar_correo_reserva(
  p_id bigint, p_exito boolean, p_error text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update correos_reserva
     set estado = case
           when p_exito then 'enviado'
           when intentos >= 5 then 'fallido'
           else 'pendiente'
         end,
         enviado_at = case when p_exito then now() else enviado_at end,
         ultimo_error = case when p_exito then null else left(p_error, 300) end,
         proximo_intento_at = case
           when not p_exito and intentos < 5
             then now() + (array[1, 5, 15, 60])[greatest(intentos, 1)] * interval '1 minute'
           else proximo_intento_at
         end,
         bloqueado_hasta = null
   where id = p_id and estado = 'enviando';
$$;


-- ---------------------------------------------------------------------
-- La llama pg_cron. Solo gasta una llamada si hay algo por enviar.
-- ---------------------------------------------------------------------
create or replace function public.disparar_correos_reserva()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url   text;
  v_token text;
begin
  if not exists (
    select 1 from correos_reserva c
     where (c.estado = 'pendiente' and c.proximo_intento_at <= now())
        or (c.estado = 'enviando' and c.bloqueado_hasta < now())
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'correos_funcion_url';
  select decrypted_secret into v_token from vault.decrypted_secrets where name = 'correos_funcion_token';

  if v_url is null or v_token is null then
    raise warning 'Faltan los secretos de Vault para enviar los correos de reserva.';
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-correos-token', v_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end; $$;


revoke execute on function public.fn_encolar_correo_reserva()                     from public, anon, authenticated;
revoke execute on function public.disparar_correos_reserva()                      from public, anon, authenticated;
revoke execute on function public.tomar_correos_reserva(int)                      from public, anon, authenticated;
revoke execute on function public.marcar_correo_reserva(bigint, boolean, text)    from public, anon, authenticated;
grant  execute on function public.tomar_correos_reserva(int)                      to service_role;
grant  execute on function public.marcar_correo_reserva(bigint, boolean, text)    to service_role;


-- Reprograma el job si ya existía.
select cron.unschedule(jobid) from cron.job where jobname = 'enviar-correos-reserva';
select cron.schedule('enviar-correos-reserva', '* * * * *', 'select public.disparar_correos_reserva()');
