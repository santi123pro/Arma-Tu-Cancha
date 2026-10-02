-- ═══════════════════════════════════════════════════════════════════
-- 0012_analitica_sede.sql
--
-- Analítica al detalle de UNA sede.
--
--  · El administrador de sede ve la suya. La sede sale de mi_sede(): el
--    navegador no la elige, así que no puede pedir la de otra sede
--    aunque mande p_sede_id.
--  · El superadmin puede pedir cualquiera con p_sede_id (y sigue
--    teniendo metricas_globales() para el negocio completo).
--
-- No depende de 0009: si esa migración no se corrió, esta funciona igual.
-- Reemplaza a metricas_mi_sede() en el panel.
--
-- Qué devuelve, para el periodo [p_desde, p_hasta]:
--   resumen          ingresos, reservas, horas, ocupación, ticket
--                    promedio, clientes nuevos y recurrentes, cancelaciones
--   anterior         lo mismo del periodo inmediatamente anterior, para
--                    mostrar si subió o bajó
--   reservas_por_dia
--   por_cancha       cada cancha con reservas, horas, ocupación e
--                    ingresos, de la más usada a la menos usada
--   por_hora         uso de cada franja del día (horas pico y muertas)
--   por_dia_semana
--   por_estado, por_metodo_pago, top_clientes
--
-- Ocupación = horas reservadas / horas que la sede tuvo abiertas cada
-- cancha activa en el periodo.
--
-- Es idempotente. Cómo correrlo: Supabase → SQL Editor → pegar → Run.
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.analitica_sede(date, date, bigint);

create function public.analitica_sede(
  p_desde   date   default (current_date - 30),
  p_hasta   date   default current_date,
  p_sede_id bigint default null
)
returns json
language plpgsql stable security definer
set search_path = public
set timezone = 'America/Bogota'
as $$
declare
  v_sede        bigint;
  v_dias        integer;
  v_prev_desde  date;
  v_prev_hasta  date;
  v_apertura    time;
  v_cierre      time;
  v_horas_dia   numeric;
  v_canchas     integer;
  v_res         json;
begin
  if es_superadmin() then
    v_sede := p_sede_id;
    if v_sede is null then
      raise exception 'Elige una sede para ver su analítica.' using errcode = 'P0010';
    end if;
  elsif mi_rol() = 'admin_sede' then
    v_sede := mi_sede();
  end if;

  if v_sede is null then
    raise exception 'Tu cuenta no administra ninguna sede.' using errcode = 'P0006';
  end if;
  if p_hasta < p_desde then
    raise exception 'El rango de fechas no es válido.' using errcode = 'P0010';
  end if;

  select hora_apertura, hora_cierre into v_apertura, v_cierre from sedes where id = v_sede;
  if not found then
    raise exception 'Esa sede no existe.' using errcode = 'P0002';
  end if;

  v_dias       := (p_hasta - p_desde) + 1;
  v_prev_hasta := p_desde - 1;
  v_prev_desde := p_desde - v_dias;
  v_horas_dia  := extract(epoch from (v_cierre - v_apertura)) / 3600;
  select count(*) into v_canchas from canchas where sede_id = v_sede and activa;

  with
  canchas_sede as (
    select id, nombre, tipo, precio_hora, activa from canchas where sede_id = v_sede
  ),
  -- Todas las reservas de la sede, con su duración y la clave del cliente.
  -- Una reserva sin usuario (hecha en mostrador) se identifica por nombre.
  todas as (
    select r.*,
           round(extract(epoch from (r.hora_fin - r.hora_inicio)) / 3600, 2) as horas,
           coalesce(r.usuario_id::text, 'nombre:' || lower(trim(r.cliente_nombre))) as cliente
      from reservas r
     where r.cancha_id in (select id from canchas_sede)
  ),
  rango   as (select * from todas where fecha between p_desde and p_hasta),
  validas as (select * from rango where estado in ('confirmada', 'completada')),
  previas as (
    select * from todas
     where fecha between v_prev_desde and v_prev_hasta
       and estado in ('confirmada', 'completada')
  ),
  -- Primera reserva válida de cada cliente en la sede (para "nuevos").
  primera as (
    select cliente, min(fecha) as desde
      from todas where estado in ('confirmada', 'completada')
     group by cliente
  ),
  por_cliente as (
    select cliente, count(*) as n from validas group by cliente
  )
  select json_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'dias',  v_dias,
    'sede',  (select json_build_object(
                'id', s.id, 'nombre', s.nombre,
                'hora_apertura', s.hora_apertura, 'hora_cierre', s.hora_cierre,
                'canchas_activas', v_canchas)
                from sedes s where s.id = v_sede),

    'resumen', json_build_object(
      'reservas',             (select count(*) from validas),
      'ingresos',             (select coalesce(sum(precio_total), 0) from validas),
      'horas',                (select coalesce(sum(horas), 0) from validas),
      'ticket_promedio',      (select coalesce(round(avg(precio_total)), 0) from validas),
      'ocupacion',            (select case when v_canchas * v_horas_dia * v_dias > 0
                                      then round(100 * coalesce(sum(v.horas), 0)
                                                 / (v_canchas * v_horas_dia * v_dias), 1)
                                      else 0 end
                                 from validas v
                                 join canchas_sede c on c.id = v.cancha_id and c.activa),
      'canceladas',           (select count(*) from rango where estado = 'cancelada'),
      'no_asistio',           (select count(*) from rango where estado = 'no_asistio'),
      'tasa_cancelacion',     (select case when count(*) > 0
                                      then round(100.0 * count(*) filter (where estado = 'cancelada') / count(*), 1)
                                      else 0 end
                                 from rango),
      'clientes',             (select count(*) from por_cliente),
      'clientes_nuevos',      (select count(*) from por_cliente pc
                                 join primera p using (cliente)
                                where p.desde >= p_desde),
      'clientes_recurrentes', (select count(*) from por_cliente where n >= 2),
      'reservas_hoy',         (select count(*) from todas
                                where fecha = current_date and estado in ('confirmada', 'pendiente')),
      'partidos_abiertos',    (select count(*) from partidos_abiertos p
                                where p.cancha_id in (select id from canchas_sede)
                                  and p.estado = 'abierto' and p.fecha >= current_date),
      'torneos_activos',      (select count(*) from torneos
                                where sede_id = v_sede and estado in ('inscripciones', 'cerrado', 'en_curso'))
    ),

    'anterior', json_build_object(
      'desde',    v_prev_desde,
      'hasta',    v_prev_hasta,
      'reservas', (select count(*) from previas),
      'ingresos', (select coalesce(sum(precio_total), 0) from previas),
      'horas',    (select coalesce(sum(horas), 0) from previas),
      'clientes', (select count(distinct cliente) from previas)
    ),

    'reservas_por_dia', (
      select coalesce(json_agg(x order by x.fecha), '[]'::json)
        from (
          select d::date as fecha,
                 count(v.id) as reservas,
                 coalesce(sum(v.precio_total), 0) as ingresos
            from generate_series(p_desde, p_hasta, interval '1 day') as d
            left join validas v on v.fecha = d::date
           group by d
        ) x
    ),

    -- Las canchas activas aunque no tengan reservas, y las retiradas que
    -- sí tuvieron en el periodo. De la más usada a la menos usada.
    'por_cancha', (
      select coalesce(json_agg(x order by x.horas desc, x.reservas desc, x.cancha), '[]'::json)
        from (
          select c.id,
                 c.nombre as cancha,
                 c.tipo,
                 c.precio_hora,
                 c.activa,
                 count(v.id) as reservas,
                 coalesce(sum(v.horas), 0) as horas,
                 coalesce(sum(v.precio_total), 0) as ingresos,
                 case when v_horas_dia * v_dias > 0
                      then round(100 * coalesce(sum(v.horas), 0) / (v_horas_dia * v_dias), 1)
                      else 0 end as ocupacion,
                 (select count(*) from rango r
                   where r.cancha_id = c.id and r.estado = 'cancelada') as canceladas,
                 max(v.fecha) as ultima_reserva
            from canchas_sede c
            left join validas v on v.cancha_id = c.id
           group by c.id, c.nombre, c.tipo, c.precio_hora, c.activa
          having c.activa or count(v.id) > 0
        ) x
    ),

    -- Cada franja de una hora del horario de la sede y cuántas reservas
    -- la ocuparon (una reserva de 2 horas cuenta en las dos franjas).
    'por_hora', (
      select coalesce(json_agg(x order by x.hora), '[]'::json)
        from (
          select h::time as hora,
                 count(v.id) as reservas,
                 case when v_canchas * v_dias > 0
                      then round(100.0 * count(v.id) / (v_canchas * v_dias), 1)
                      else 0 end as ocupacion
            from generate_series(
                   timestamp '2000-01-01' + v_apertura,
                   timestamp '2000-01-01' + v_cierre - interval '1 hour',
                   interval '1 hour'
                 ) as h
            left join validas v
              on v.hora_inicio <= h::time and v.hora_fin > h::time
           group by h
        ) x
    ),

    -- 1 = lunes … 7 = domingo. Siempre los siete días.
    'por_dia_semana', (
      select coalesce(json_agg(x order by x.dia), '[]'::json)
        from (
          select d.dia,
                 count(v.id) as reservas,
                 coalesce(sum(v.precio_total), 0) as ingresos
            from generate_series(1, 7) as d(dia)
            left join validas v on extract(isodow from v.fecha) = d.dia
           group by d.dia
        ) x
    ),

    'por_estado', (
      select coalesce(json_object_agg(estado, n), '{}'::json)
        from (select estado, count(*) as n from rango group by estado) x
    ),

    'por_metodo_pago', (
      select coalesce(json_agg(x order by x.reservas desc), '[]'::json)
        from (
          select coalesce(metodo_pago, 'sin_registrar') as metodo,
                 count(*) as reservas,
                 sum(precio_total) as ingresos
            from validas
           group by 1
        ) x
    ),

    'top_clientes', (
      select coalesce(json_agg(x), '[]'::json)
        from (
          select coalesce(max(pf.nombre), max(v.cliente_nombre)) as nombre,
                 count(*) as reservas,
                 sum(v.precio_total) as ingresos,
                 max(v.fecha) as ultima_reserva
            from validas v
            left join perfiles pf on pf.id = v.usuario_id
           group by v.cliente
           order by count(*) desc, sum(v.precio_total) desc
           limit 5
        ) x
    )
  ) into v_res;

  return v_res;
end; $$;

revoke execute on function public.analitica_sede(date, date, bigint) from public, anon;
grant  execute on function public.analitica_sede(date, date, bigint) to authenticated;
