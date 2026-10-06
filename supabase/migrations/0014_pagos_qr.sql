-- ═══════════════════════════════════════════════════════════════════
-- 0014_pagos_qr.sql
--
-- Pago con QR (Nequi o Bre-B) y aprobación manual de la sede.
--
-- No hay pasarela: el jugador paga con el QR de la sede, adjunta el
-- comprobante y el administrador confirma que el dinero llegó. Una
-- reserva solo queda confirmada cuando la sede aprueba el pago.
--
--   1. Solicitar      crear_reserva() deja la reserva 'pendiente' con
--                     pago 'esperando_pago'. El horario queda apartado
--                     hasta pago_vence_at (pago_minutos_limite de la sede).
--   2. Reportar       reportar_pago(): el jugador dice por qué medio pagó
--                     (nequi/breb) y adjunta el comprobante. Pasa a
--                     'por_verificar' y el horario sigue apartado.
--   3. Revisar        revisar_pago(): la sede aprueba (reserva
--                     'confirmada') o rechaza con un motivo ('cancelada').
--   ·  Vencer         Si no reporta a tiempo, liberar_reservas_vencidas()
--                     la cancela ('vencido') y el horario vuelve a estar
--                     libre. disponibilidad_cancha() ya las ignora antes
--                     de que se limpien.
--
-- Estados del pago (reservas.pago_estado):
--   esperando_pago · por_verificar · aprobado · rechazado · vencido · cancelado
--   NULL = reserva anterior a esta migración.
--
-- Medios de pago de cada sede (sede_metodos_pago), uno por tipo:
--   nequi  QR + celular Nequi
--   breb   QR + llave Bre-B (celular, cédula, correo o alfanumérica)
--
-- Requiere 0007 (administro_sede, mi_sede) y 0010 (restricción de solape).
-- Es idempotente. Cómo correrlo: Supabase → SQL Editor → pegar → Run.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 1. CONFIGURACIÓN DE PAGO DE CADA SEDE
-- ───────────────────────────────────────────────────────────────────
alter table public.sedes
  add column if not exists pago_instrucciones   text,
  add column if not exists pago_minutos_limite  integer not null default 30;

alter table public.sedes drop constraint if exists sedes_pago_minutos_rango;
alter table public.sedes
  add constraint sedes_pago_minutos_rango check (pago_minutos_limite between 10 and 1440);

-- Un registro por sede y medio. Son públicos a propósito: quien va a
-- pagar necesita verlos. Se escriben solo con configurar_pago_sede().
create table if not exists public.sede_metodos_pago (
  id             bigint generated always as identity primary key,
  sede_id        bigint       not null references public.sedes(id) on delete cascade,
  tipo           varchar(10)  not null,
  activo         boolean      not null default true,
  qr_url         text,
  titular        varchar(120),
  cuenta         varchar(80),
  actualizado_at timestamptz  not null default now(),

  constraint sede_metodos_pago_tipo_valido check (tipo in ('nequi', 'breb')),
  constraint sede_metodos_pago_unico unique (sede_id, tipo)
);

alter table public.sede_metodos_pago enable row level security;

drop policy if exists sede_metodos_pago_lectura on public.sede_metodos_pago;
create policy sede_metodos_pago_lectura on public.sede_metodos_pago
  for select to anon, authenticated
  using (activo or public.administro_sede(sede_id));

-- Sin medios activos no se puede reservar (ver crear_reserva), así que
-- cada sede arranca con Nequi y Bre-B activos. Mientras el admin no suba
-- su QR, el jugador ve un QR de ejemplo.
insert into public.sede_metodos_pago (sede_id, tipo)
select s.id, t.tipo
  from public.sedes s
 cross join (values ('nequi'), ('breb')) as t(tipo)
on conflict (sede_id, tipo) do nothing;


-- ───────────────────────────────────────────────────────────────────
-- 2. SEGUIMIENTO DEL PAGO EN CADA RESERVA
-- ───────────────────────────────────────────────────────────────────
alter table public.reservas
  add column if not exists pago_estado          varchar(20),
  add column if not exists pago_medio           varchar(10),
  add column if not exists pago_vence_at        timestamptz,
  add column if not exists pago_referencia      varchar(120),
  add column if not exists comprobante_path     text,
  add column if not exists pago_reportado_at    timestamptz,
  add column if not exists pago_revisado_por    uuid references auth.users(id) on delete set null,
  add column if not exists pago_revisado_at     timestamptz,
  add column if not exists pago_motivo_rechazo  text;

alter table public.reservas drop constraint if exists reservas_pago_estado_valido;
alter table public.reservas
  add constraint reservas_pago_estado_valido check (
    pago_estado is null or pago_estado in
      ('esperando_pago', 'por_verificar', 'aprobado', 'rechazado', 'vencido', 'cancelado')
  );

alter table public.reservas drop constraint if exists reservas_pago_medio_valido;
alter table public.reservas
  add constraint reservas_pago_medio_valido check (pago_medio is null or pago_medio in ('nequi', 'breb'));

-- Bre-B se suma a los métodos con que se registra un pago.
alter table public.reservas drop constraint if exists reservas_pago_valido;
alter table public.reservas
  add constraint reservas_pago_valido check (
    metodo_pago is null or metodo_pago in ('efectivo', 'nequi', 'breb', 'transferencia', 'daviplata')
  );

create index if not exists reservas_pago_pendiente_idx
  on public.reservas (pago_estado, pago_vence_at)
  where estado = 'pendiente';


-- ───────────────────────────────────────────────────────────────────
-- 3. LIBERAR LAS SOLICITUDES QUE NO SE PAGARON A TIEMPO
-- ───────────────────────────────────────────────────────────────────
-- Se llama antes de crear una reserva y al abrir el panel de pagos.
-- Sin pg_cron no hay un proceso que corra solo, así que la limpieza se
-- hace "cuando alguien pasa"; mientras tanto disponibilidad_cancha()
-- ya trata esas franjas como libres.
create or replace function public.liberar_reservas_vencidas()
returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update reservas
     set estado = 'cancelada', pago_estado = 'vencido', cancelado_at = now()
   where estado = 'pendiente'
     and pago_estado = 'esperando_pago'
     and pago_vence_at < now();
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

revoke execute on function public.liberar_reservas_vencidas() from public, anon;
grant  execute on function public.liberar_reservas_vencidas() to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 4. CREAR RESERVA: ahora nace pendiente de pago
-- ───────────────────────────────────────────────────────────────────
-- Misma firma que en 0003, así el frontend no cambia la llamada.
-- Si quien reserva administra la sede (reserva de mostrador), queda
-- confirmada de una vez: el pago lo recibe él mismo.
create or replace function public.crear_reserva(
  p_cancha_id      bigint,
  p_fecha          date,
  p_hora_inicio    time,
  p_duracion_horas int          default 1,
  p_cliente_nombre varchar(120) default null,
  p_cliente_tel    varchar(30)  default null,
  p_cliente_correo varchar(160) default null,
  p_metodo_pago    varchar(20)  default null,
  p_notas          text         default null
)
returns public.reservas
language plpgsql
security definer
set search_path = public
set timezone = 'America/Bogota'
as $$
declare
  v_cancha   record;
  v_hora_fin time;
  v_nombre   varchar(120);
  v_reserva  public.reservas;
  v_intento  int := 0;
  v_admin    boolean;
  v_vence    timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para reservar.' using errcode = 'P0001';
  end if;

  select c.id, c.precio_hora, c.nombre, s.id as sede_id, s.slug, s.nombre as sede,
         s.hora_apertura, s.hora_cierre, s.pago_minutos_limite
    into v_cancha
    from canchas c join sedes s on s.id = c.sede_id
   where c.id = p_cancha_id and c.activa and s.activa;

  if not found then
    raise exception 'Esa cancha no existe o no está disponible.' using errcode = 'P0002';
  end if;

  if p_fecha < current_date then
    raise exception 'No puedes reservar en una fecha que ya pasó.' using errcode = 'P0003';
  end if;
  if p_fecha > current_date + 15 then
    raise exception 'Solo puedes reservar con hasta 15 días de anticipación.' using errcode = 'P0003';
  end if;
  if p_duracion_horas is null or p_duracion_horas < 1 then
    raise exception 'La reserva debe durar al menos una hora.' using errcode = 'P0003';
  end if;

  v_hora_fin := p_hora_inicio + (p_duracion_horas || ' hours')::interval;

  if p_hora_inicio < v_cancha.hora_apertura or v_hora_fin > v_cancha.hora_cierre
     or v_hora_fin <= p_hora_inicio then
    raise exception '% atiende de % a %.',
      v_cancha.sede,
      to_char(v_cancha.hora_apertura, 'HH12:MI AM'),
      to_char(v_cancha.hora_cierre,   'HH12:MI AM')
      using errcode = 'P0004';
  end if;

  if (p_fecha + p_hora_inicio) <= now()::timestamp then
    raise exception 'Esa hora ya pasó. Elige un horario más adelante.' using errcode = 'P0003';
  end if;

  v_admin := administro_sede(v_cancha.sede_id);

  if not v_admin then
    if not exists (select 1 from sede_metodos_pago
                    where sede_id = v_cancha.sede_id and activo) then
      raise exception '% todavía no ha configurado sus medios de pago. Comunícate con la sede para reservar.',
        v_cancha.sede using errcode = 'P0011';
    end if;

    -- Evita que una sola cuenta aparte muchos horarios sin pagarlos.
    if (select count(*) from reservas
         where usuario_id = auth.uid()
           and estado = 'pendiente'
           and pago_estado = 'esperando_pago'
           and pago_vence_at > now()) >= 2 then
      raise exception 'Tienes dos reservas esperando pago. Págalas o cancélalas antes de solicitar otra.'
        using errcode = 'P0011';
    end if;

    -- El plazo nunca pasa de la hora de inicio del partido.
    v_vence := least(
      now() + make_interval(mins => v_cancha.pago_minutos_limite),
      (p_fecha + p_hora_inicio)::timestamptz
    );
  end if;

  -- Una solicitud vencida todavía ocupa la franja para la restricción de
  -- solape hasta que se limpia; se limpia antes de insertar.
  perform liberar_reservas_vencidas();

  v_nombre := coalesce(
    p_cliente_nombre,
    (select nombre from perfiles where id = auth.uid()),
    'Sin nombre'
  );

  loop
    v_intento := v_intento + 1;
    begin
      insert into reservas (
        cancha_id, usuario_id, fecha, hora_inicio, hora_fin,
        cliente_nombre, cliente_tel, cliente_correo,
        codigo, precio_total, estado, metodo_pago, notas,
        pago_estado, pago_vence_at, pago_revisado_por, pago_revisado_at
      ) values (
        p_cancha_id, auth.uid(), p_fecha, p_hora_inicio, v_hora_fin,
        v_nombre,
        coalesce(p_cliente_tel, (select telefono from perfiles where id = auth.uid())),
        coalesce(p_cliente_correo, auth.jwt()->>'email'),
        fn_generar_codigo(v_cancha.slug),
        v_cancha.precio_hora * p_duracion_horas,
        case when v_admin then 'confirmada' else 'pendiente' end,
        case when v_admin then p_metodo_pago end,
        p_notas,
        case when v_admin then 'aprobado' else 'esperando_pago' end,
        v_vence,
        case when v_admin then auth.uid() end,
        case when v_admin then now() end
      )
      returning * into v_reserva;
      return v_reserva;
    exception
      when unique_violation then
        if position('codigo' in coalesce(sqlerrm, '')) > 0 and v_intento < 3 then
          continue;
        end if;
        raise;
    end;
  end loop;
end; $$;

grant execute on function public.crear_reserva(
  bigint, date, time, int, varchar, varchar, varchar, varchar, text
) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 5. DISPONIBILIDAD: las solicitudes vencidas no ocupan
-- ───────────────────────────────────────────────────────────────────
-- Igual que en 0010, más la excepción de las solicitudes sin pagar
-- cuyo plazo ya pasó.
create or replace function public.disponibilidad_cancha(
  p_cancha_id bigint,
  p_fecha     date
)
returns table (hora_inicio time, hora_fin time, disponible boolean, precio integer)
language sql stable security definer set search_path = public
set timezone = 'America/Bogota' as $$
  with cancha as (
    select c.precio_hora, s.hora_apertura, s.hora_cierre
      from canchas c join sedes s on s.id = c.sede_id
     where c.id = p_cancha_id and c.activa
  ),
  franjas as (
    select gs::time as inicio, (gs + interval '1 hour')::time as fin
      from cancha,
           generate_series(
             p_fecha + cancha.hora_apertura,
             p_fecha + cancha.hora_cierre - interval '1 hour',
             interval '1 hour'
           ) as gs
  )
  select f.inicio,
         f.fin,
         (not exists (
            select 1 from reservas r
             where r.cancha_id = p_cancha_id
               and r.fecha = p_fecha
               and r.estado in ('confirmada', 'pendiente')
               and not (r.estado = 'pendiente'
                        and r.pago_estado = 'esperando_pago'
                        and r.pago_vence_at < now())
               and tsrange(r.fecha + r.hora_inicio, r.fecha + r.hora_fin, '[)')
                && tsrange(p_fecha + f.inicio,      p_fecha + f.fin,      '[)')
          )
          and (p_fecha > current_date or f.inicio > current_time)) as disponible,
         (select precio_hora from cancha)
    from franjas f
   order by f.inicio;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 6. EL JUGADOR ENVÍA EL COMPROBANTE
-- ───────────────────────────────────────────────────────────────────
-- p_comprobante es la ruta del archivo en el bucket 'comprobantes'.
-- Tiene que estar en la carpeta de esta reserva ('<id>/...'), para que
-- nadie apunte al comprobante de otra persona.
drop function if exists public.reportar_pago(bigint, varchar, text);

create or replace function public.reportar_pago(
  p_reserva_id  bigint,
  p_medio       varchar(10),
  p_comprobante text,
  p_referencia  varchar(120) default null
)
returns public.reservas
language plpgsql security definer set search_path = public
set timezone = 'America/Bogota' as $$
declare v_r record; v_out public.reservas;
begin
  select r.*, c.sede_id into v_r
    from reservas r join canchas c on c.id = r.cancha_id
   where r.id = p_reserva_id
   for update of r;

  if not found then
    raise exception 'Esa reserva no existe.' using errcode = 'P0002';
  end if;
  if v_r.usuario_id is distinct from auth.uid() then
    raise exception 'No puedes reportar el pago de una reserva que no es tuya.' using errcode = 'P0006';
  end if;
  if v_r.pago_estado = 'por_verificar' then
    raise exception 'Ya enviaste este comprobante. La sede lo está verificando.' using errcode = 'P0005';
  end if;
  if v_r.estado <> 'pendiente' or v_r.pago_estado is distinct from 'esperando_pago' then
    raise exception 'Esta reserva ya no admite pagos.' using errcode = 'P0005';
  end if;
  if v_r.pago_vence_at < now() then
    raise exception 'El tiempo para pagar venció y el horario se liberó. Solicita la reserva de nuevo.'
      using errcode = 'P0005';
  end if;
  if not exists (select 1 from sede_metodos_pago
                  where sede_id = v_r.sede_id and tipo = p_medio and activo) then
    raise exception 'Elige un medio de pago que acepte la sede.' using errcode = 'P0010';
  end if;
  if p_comprobante is null then
    raise exception 'Adjunta el comprobante del pago.' using errcode = 'P0010';
  end if;
  if p_comprobante not like p_reserva_id || '/%' then
    raise exception 'El comprobante no corresponde a esta reserva.' using errcode = 'P0010';
  end if;

  update reservas
     set pago_estado       = 'por_verificar',
         pago_medio        = p_medio,
         pago_reportado_at = now(),
         pago_referencia   = nullif(trim(coalesce(p_referencia, '')), ''),
         comprobante_path  = p_comprobante
   where id = p_reserva_id
  returning * into v_out;
  return v_out;
end; $$;

revoke execute on function public.reportar_pago(bigint, varchar, text, varchar) from public, anon;
grant  execute on function public.reportar_pago(bigint, varchar, text, varchar) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 7. LA SEDE APRUEBA O RECHAZA EL PAGO
-- ───────────────────────────────────────────────────────────────────
-- Puede aprobar también una que sigue 'esperando_pago' (el dinero llegó
-- pero el jugador no alcanzó a enviar el comprobante). El método que
-- queda registrado es el que eligió el jugador, salvo que la sede diga otro.
create or replace function public.revisar_pago(
  p_reserva_id  bigint,
  p_aprobar     boolean,
  p_metodo_pago varchar(20) default null,
  p_motivo      text        default null
)
returns public.reservas
language plpgsql security definer set search_path = public
set timezone = 'America/Bogota' as $$
declare v_r record; v_metodo varchar(20); v_out public.reservas;
begin
  select r.*, c.sede_id into v_r
    from reservas r join canchas c on c.id = r.cancha_id
   where r.id = p_reserva_id
   for update of r;

  if not found then
    raise exception 'Esa reserva no existe.' using errcode = 'P0002';
  end if;
  if not administro_sede(v_r.sede_id) then
    raise exception 'Solo el administrador de la sede puede revisar pagos.' using errcode = 'P0006';
  end if;
  if v_r.estado <> 'pendiente' or v_r.pago_estado not in ('esperando_pago', 'por_verificar') then
    raise exception 'Este pago ya fue revisado o la reserva se canceló.' using errcode = 'P0005';
  end if;

  if p_aprobar then
    v_metodo := coalesce(p_metodo_pago, v_r.pago_medio, 'transferencia');
    if v_metodo not in ('efectivo', 'nequi', 'breb', 'transferencia', 'daviplata') then
      raise exception 'Método de pago no válido.' using errcode = 'P0010';
    end if;
    update reservas
       set estado            = 'confirmada',
           pago_estado       = 'aprobado',
           metodo_pago       = v_metodo,
           pago_revisado_por = auth.uid(),
           pago_revisado_at  = now()
     where id = p_reserva_id
    returning * into v_out;
  else
    if nullif(trim(coalesce(p_motivo, '')), '') is null then
      raise exception 'Escribe el motivo del rechazo para que el jugador sepa qué pasó.' using errcode = 'P0010';
    end if;
    update reservas
       set estado              = 'cancelada',
           cancelado_at        = now(),
           pago_estado         = 'rechazado',
           pago_motivo_rechazo = trim(p_motivo),
           pago_revisado_por   = auth.uid(),
           pago_revisado_at    = now()
     where id = p_reserva_id
    returning * into v_out;
  end if;

  return v_out;
end; $$;

revoke execute on function public.revisar_pago(bigint, boolean, varchar, text) from public, anon;
grant  execute on function public.revisar_pago(bigint, boolean, varchar, text) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 8. CANCELAR: una solicitud sin pagar se cancela en cualquier momento
-- ───────────────────────────────────────────────────────────────────
-- La regla de las 24 horas protege a la sede de perder una reserva
-- pagada. Si todavía no se pagó, no hay nada que proteger.
create or replace function public.cancelar_reserva(p_reserva_id bigint)
returns public.reservas
language plpgsql security definer set search_path = public
set timezone = 'America/Bogota' as $$
declare v_r record; v_es_admin boolean; v_horas numeric; v_out public.reservas;
begin
  select r.*, c.sede_id into v_r
    from reservas r join canchas c on c.id = r.cancha_id
   where r.id = p_reserva_id
   for update of r;

  if not found then
    raise exception 'Esa reserva no existe.' using errcode = 'P0002';
  end if;
  if v_r.estado = 'cancelada' then
    raise exception 'Esa reserva ya estaba cancelada.' using errcode = 'P0005';
  end if;

  v_es_admin := administro_sede(v_r.sede_id);

  if v_r.usuario_id is distinct from auth.uid() and not v_es_admin then
    raise exception 'No puedes cancelar una reserva que no es tuya.' using errcode = 'P0006';
  end if;

  if not v_es_admin and v_r.pago_estado is distinct from 'esperando_pago' then
    v_horas := extract(epoch from ((v_r.fecha + v_r.hora_inicio) - now()::timestamp)) / 3600;
    if v_horas < 24 then
      raise exception 'Faltan menos de 24 horas. Comunícate con la sede.' using errcode = 'P0007';
    end if;
  end if;

  update reservas
     set estado       = 'cancelada',
         cancelado_at = now(),
         pago_estado  = case when pago_estado = 'esperando_pago' then 'cancelado' else pago_estado end
   where id = p_reserva_id
  returning * into v_out;
  return v_out;
end; $$;


-- ───────────────────────────────────────────────────────────────────
-- 9. PANEL "CONFIRMAR RESERVAS" DE LA SEDE
-- ───────────────────────────────────────────────────────────────────
-- Al admin de sede se le fija la suya; el superadmin elige con p_sede_id.
-- Devuelve la configuración de pago, las que esperan revisión y las
-- revisadas en los últimos 30 días, con el contacto del cliente.
create or replace function public.pagos_sede(p_sede_id bigint default null)
returns json
language plpgsql security definer set search_path = public
set timezone = 'America/Bogota' as $$
declare v_sede bigint; v_res json;
begin
  if es_superadmin() then
    v_sede := p_sede_id;
  elsif mi_rol() = 'admin_sede' then
    v_sede := mi_sede();
  end if;
  if v_sede is null then
    raise exception 'Elige la sede cuyos pagos quieres revisar.' using errcode = 'P0006';
  end if;

  perform liberar_reservas_vencidas();

  with base as (
    select r.id, r.codigo, r.fecha, r.hora_inicio, r.hora_fin, r.precio_total,
           r.estado, r.pago_estado, r.pago_medio, r.pago_vence_at, r.pago_referencia,
           r.comprobante_path, r.pago_reportado_at, r.pago_revisado_at,
           r.pago_motivo_rechazo, r.metodo_pago, r.creado_at,
           c.nombre as cancha, c.tipo as cancha_tipo,
           coalesce(pf.nombre, r.cliente_nombre) as cliente,
           coalesce(pf.telefono, r.cliente_tel)  as telefono,
           r.cliente_correo as correo
      from reservas r
      join canchas c on c.id = r.cancha_id
      left join perfiles pf on pf.id = r.usuario_id
     where c.sede_id = v_sede
       and r.pago_estado is not null
  )
  select json_build_object(
    'sede', (select json_build_object(
               'id', s.id, 'nombre', s.nombre,
               'pago_instrucciones', s.pago_instrucciones,
               'pago_minutos_limite', s.pago_minutos_limite)
               from sedes s where s.id = v_sede),
    'metodos', (
      select coalesce(json_agg(m order by m.tipo desc), '[]'::json)
        from (select tipo, activo, qr_url, titular, cuenta
                from sede_metodos_pago where sede_id = v_sede) m
    ),
    'por_verificar', (
      select coalesce(json_agg(b order by b.pago_reportado_at), '[]'::json)
        from base b where b.estado = 'pendiente' and b.pago_estado = 'por_verificar'
    ),
    'esperando_pago', (
      select coalesce(json_agg(b order by b.pago_vence_at), '[]'::json)
        from base b where b.estado = 'pendiente' and b.pago_estado = 'esperando_pago'
    ),
    'revisados', (
      select coalesce(json_agg(b order by b.pago_revisado_at desc), '[]'::json)
        from (select * from base
               where pago_estado in ('aprobado', 'rechazado')
                 and pago_revisado_at > now() - interval '30 days'
               order by pago_revisado_at desc
               limit 60) b
    )
  ) into v_res;

  return v_res;
end; $$;

revoke execute on function public.pagos_sede(bigint) from public, anon;
grant  execute on function public.pagos_sede(bigint) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 10. CONFIGURAR LOS MEDIOS DE PAGO DE LA SEDE
-- ───────────────────────────────────────────────────────────────────
-- Por función y no por update directo: así el admin solo toca estos
-- datos y no el nombre, el horario o el estado de la sede.
--
-- p_metodos: [{ "tipo": "nequi", "activo": true, "qr_url": "...",
--               "titular": "...", "cuenta": "300..." }, { "tipo": "breb", ... }]
drop function if exists public.configurar_pago_sede(bigint, text, varchar, varchar, varchar, text, integer);

create or replace function public.configurar_pago_sede(
  p_sede_id       bigint,
  p_metodos       jsonb,
  p_instrucciones text,
  p_minutos       integer
)
returns json
language plpgsql security definer set search_path = public as $$
declare v_m jsonb;
begin
  if not administro_sede(p_sede_id) then
    raise exception 'Solo el administrador de la sede puede cambiar sus datos de pago.' using errcode = 'P0006';
  end if;
  if not exists (select 1 from sedes where id = p_sede_id) then
    raise exception 'Esa sede no existe.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_metodos) is distinct from 'array' then
    raise exception 'Faltan los medios de pago.' using errcode = 'P0010';
  end if;
  if p_minutos is null or p_minutos < 10 or p_minutos > 1440 then
    raise exception 'El tiempo para pagar debe estar entre 10 minutos y 24 horas.' using errcode = 'P0010';
  end if;

  for v_m in select * from jsonb_array_elements(p_metodos) loop
    if coalesce(v_m->>'tipo', '') not in ('nequi', 'breb') then
      raise exception 'Medio de pago no válido: %.', v_m->>'tipo' using errcode = 'P0010';
    end if;
    if coalesce((v_m->>'activo')::boolean, false)
       and nullif(trim(coalesce(v_m->>'cuenta', '')), '') is null then
      raise exception 'Escribe el % para activar %.',
        case when v_m->>'tipo' = 'nequi' then 'número de celular' else 'número o llave' end,
        case when v_m->>'tipo' = 'nequi' then 'Nequi' else 'Bre-B' end
        using errcode = 'P0010';
    end if;

    insert into sede_metodos_pago (sede_id, tipo, activo, qr_url, titular, cuenta, actualizado_at)
    values (
      p_sede_id,
      v_m->>'tipo',
      coalesce((v_m->>'activo')::boolean, false),
      nullif(trim(coalesce(v_m->>'qr_url', '')), ''),
      left(nullif(trim(coalesce(v_m->>'titular', '')), ''), 120),
      left(nullif(trim(coalesce(v_m->>'cuenta', '')), ''), 80),
      now()
    )
    on conflict (sede_id, tipo) do update
      set activo = excluded.activo, qr_url = excluded.qr_url, titular = excluded.titular,
          cuenta = excluded.cuenta, actualizado_at = now();
  end loop;

  if not exists (select 1 from sede_metodos_pago where sede_id = p_sede_id and activo) then
    raise exception 'Deja activo al menos un medio de pago: sin él los jugadores no pueden reservar.'
      using errcode = 'P0010';
  end if;

  update sedes
     set pago_instrucciones  = nullif(trim(coalesce(p_instrucciones, '')), ''),
         pago_minutos_limite = p_minutos
   where id = p_sede_id;

  return (select json_agg(m order by m.tipo desc)
            from (select tipo, activo, qr_url, titular, cuenta
                    from sede_metodos_pago where sede_id = p_sede_id) m);
end; $$;

revoke execute on function public.configurar_pago_sede(bigint, jsonb, text, integer) from public, anon;
grant  execute on function public.configurar_pago_sede(bigint, jsonb, text, integer) to authenticated;


-- ───────────────────────────────────────────────────────────────────
-- 11. ARCHIVOS: QR de cada sede y comprobantes de pago
-- ───────────────────────────────────────────────────────────────────
--   qr-sedes      público. Ruta '<sede_id>/<archivo>'. Sube el admin.
--   comprobantes  privado. Ruta '<reserva_id>/<archivo>'. Sube el dueño
--                 de la reserva; lo ven él y el admin de la sede.

-- Primer segmento numérico de una ruta ('15/foto.jpg' → 15), o NULL.
create or replace function public.carpeta_id(p_ruta text)
returns bigint language sql immutable as $$
  select case when split_part(p_ruta, '/', 1) ~ '^[0-9]{1,18}$'
              then split_part(p_ruta, '/', 1)::bigint end;
$$;

-- Quién puede subir y ver comprobantes. Son `security definer` para que
-- la regla no dependa de los permisos que el usuario tenga sobre reservas.
create or replace function public.puedo_subir_comprobante(p_reserva_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reservas
     where id = p_reserva_id
       and usuario_id = auth.uid()
       and estado = 'pendiente'
       and pago_estado = 'esperando_pago'
  );
$$;

create or replace function public.puedo_ver_comprobante(p_reserva_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from reservas
     where id = p_reserva_id
       and (usuario_id = auth.uid() or administro_cancha(cancha_id))
  );
$$;

grant execute on function public.puedo_subir_comprobante(bigint) to authenticated;
grant execute on function public.puedo_ver_comprobante(bigint)   to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('qr-sedes',     'qr-sedes',     true,  2097152, array['image/png', 'image/jpeg', 'image/webp']),
  ('comprobantes', 'comprobantes', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists qr_sedes_subir on storage.objects;
create policy qr_sedes_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qr-sedes' and public.administro_sede(public.carpeta_id(name)));

drop policy if exists qr_sedes_borrar on storage.objects;
create policy qr_sedes_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'qr-sedes' and public.administro_sede(public.carpeta_id(name)));

drop policy if exists comprobantes_subir on storage.objects;
create policy comprobantes_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprobantes' and public.puedo_subir_comprobante(public.carpeta_id(name)));

drop policy if exists comprobantes_ver on storage.objects;
create policy comprobantes_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes' and public.puedo_ver_comprobante(public.carpeta_id(name)));
