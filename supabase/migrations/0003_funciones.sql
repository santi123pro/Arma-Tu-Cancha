-- =====================================================================
-- 0003 — Funciones de negocio y vistas de reporte
-- =====================================================================
-- Aquí vive lo que antes hacían tus rutas de Express. Se llaman desde
-- React con supabase.rpc('nombre_funcion', { parametros }).
--
-- Por qué una función y no un insert directo: crear una reserva no es
-- solo escribir una fila. Hay que validar los 15 días, el horario de la
-- sede, calcular el precio y generar el código. Eso son varias consultas
-- que deben ocurrir juntas o no ocurrir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Generar código de reserva legible por teléfono
-- ---------------------------------------------------------------------
create or replace function public.fn_generar_codigo(p_slug text)
returns text language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin I, O, 0, 1
  prefijo  text := upper(left(regexp_replace(coalesce(p_slug,'atc'), '[^a-zA-Z]', '', 'g'), 3));
  bloque   text := '';
  i int;
begin
  if prefijo = '' then prefijo := 'ATC'; end if;
  for i in 1..8 loop
    bloque := bloque || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    if i = 4 then bloque := bloque || '-'; end if;
  end loop;
  return prefijo || '-' || bloque;
end; $$;

-- ---------------------------------------------------------------------
-- CREAR RESERVA  (reemplaza POST /api/reservas)
-- ---------------------------------------------------------------------
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
as $$
declare
  v_cancha   record;
  v_hora_fin time;
  v_nombre   varchar(120);
  v_reserva  public.reservas;
  v_intento  int := 0;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para reservar.' using errcode = 'P0001';
  end if;

  select c.id, c.precio_hora, c.nombre, s.slug, s.nombre as sede,
         s.hora_apertura, s.hora_cierre
    into v_cancha
    from canchas c join sedes s on s.id = c.sede_id
   where c.id = p_cancha_id and c.activa and s.activa;

  if not found then
    raise exception 'Esa cancha no existe o no está disponible.' using errcode = 'P0002';
  end if;

  -- RN3: máximo 15 días de anticipación
  if p_fecha < current_date then
    raise exception 'No puedes reservar en una fecha que ya pasó.' using errcode = 'P0003';
  end if;
  if p_fecha > current_date + 15 then
    raise exception 'Solo puedes reservar con hasta 15 días de anticipación.' using errcode = 'P0003';
  end if;

  v_hora_fin := p_hora_inicio + (p_duracion_horas || ' hours')::interval;

  if p_hora_inicio < v_cancha.hora_apertura or v_hora_fin > v_cancha.hora_cierre then
    raise exception '% atiende de % a %.',
      v_cancha.sede,
      to_char(v_cancha.hora_apertura, 'HH12:MI AM'),
      to_char(v_cancha.hora_cierre,   'HH12:MI AM')
      using errcode = 'P0004';
  end if;

  v_nombre := coalesce(
    p_cliente_nombre,
    (select nombre from perfiles where id = auth.uid()),
    'Sin nombre'
  );

  -- Se reintenta solo si choca el código aleatorio. Si choca el horario,
  -- el índice reservas_sin_solape lanza 23505 y sale al cliente.
  loop
    v_intento := v_intento + 1;
    begin
      insert into reservas (
        cancha_id, usuario_id, fecha, hora_inicio, hora_fin,
        cliente_nombre, cliente_tel, cliente_correo,
        codigo, precio_total, estado, metodo_pago, notas
      ) values (
        p_cancha_id, auth.uid(), p_fecha, p_hora_inicio, v_hora_fin,
        v_nombre, p_cliente_tel,
        coalesce(p_cliente_correo, auth.jwt()->>'email'),
        fn_generar_codigo(v_cancha.slug),
        v_cancha.precio_hora * p_duracion_horas,
        'confirmada', p_metodo_pago, p_notas
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

-- ---------------------------------------------------------------------
-- CANCELAR RESERVA  (reemplaza DELETE /api/reservas/:id)
-- ---------------------------------------------------------------------
-- RN2: el jugador no puede cancelar con menos de 24 horas; el
-- administrador sí, porque en la entrevista dijeron que a veces autorizan
-- excepciones por emergencia.
-- ---------------------------------------------------------------------
create or replace function public.cancelar_reserva(p_reserva_id bigint)
returns public.reservas
language plpgsql security definer set search_path = public as $$
declare v_r record; v_es_admin boolean; v_horas numeric; v_out public.reservas;
begin
  select r.*, c.sede_id into v_r
    from reservas r join canchas c on c.id = r.cancha_id
   where r.id = p_reserva_id;

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

  if not v_es_admin then
    v_horas := extract(epoch from ((v_r.fecha + v_r.hora_inicio) - now())) / 3600;
    if v_horas < 24 then
      raise exception 'Faltan menos de 24 horas. Comunícate con el establecimiento.'
        using errcode = 'P0007';
    end if;
  end if;

  update reservas set estado = 'cancelada', cancelado_at = now()
   where id = p_reserva_id returning * into v_out;
  return v_out;
end; $$;

-- ---------------------------------------------------------------------
-- DISPONIBILIDAD  (reemplaza GET /api/canchas/:id/disponibilidad)
-- ---------------------------------------------------------------------
-- Devuelve todas las franjas del día con su estado. Las que nunca se
-- reservaron no existen en la tabla reservas, por eso se generan aquí
-- con generate_series y se cruzan con LEFT JOIN.
-- ---------------------------------------------------------------------
create or replace function public.disponibilidad_cancha(
  p_cancha_id bigint,
  p_fecha     date
)
returns table (hora_inicio time, hora_fin time, disponible boolean, precio integer)
language sql stable security definer set search_path = public as $$
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
  ),
  tomadas as (
    select r.hora_inicio from reservas r
     where r.cancha_id = p_cancha_id and r.fecha = p_fecha
       and r.estado in ('confirmada','pendiente')
  )
  select f.inicio, f.fin,
         (t.hora_inicio is null
          and (p_fecha > current_date or f.inicio > current_time)) as disponible,
         (select precio_hora from cancha)
    from franjas f
    left join tomadas t on t.hora_inicio = f.inicio
   order by f.inicio;
$$;

-- ---------------------------------------------------------------------
-- MÉTRICAS DEL PANEL  (reemplaza GET /api/dashboard/metricas)
-- ---------------------------------------------------------------------
create or replace function public.metricas_sede(
  p_desde date default (current_date - 30),
  p_hasta date default current_date
)
returns json
language plpgsql stable security definer set search_path = public as $$
declare v_sede bigint; v_res json;
begin
  v_sede := mi_sede();
  if v_sede is null and mi_rol() <> 'superadmin' then
    raise exception 'Tu cuenta no administra ningún establecimiento.' using errcode = 'P0006';
  end if;

  select json_build_object(
    'reservas',      count(*) filter (where r.estado in ('confirmada','completada')),
    'canceladas',    count(*) filter (where r.estado = 'cancelada'),
    'ingresos',      coalesce(sum(r.precio_total) filter (where r.estado in ('confirmada','completada')), 0),
    'reservas_hoy',  count(*) filter (where r.fecha = current_date and r.estado in ('confirmada','pendiente')),
    'clientes',      count(distinct r.cliente_nombre)
  ) into v_res
  from reservas r join canchas c on c.id = r.cancha_id
  where c.sede_id = v_sede and r.fecha between p_desde and p_hasta;

  return v_res;
end; $$;

-- ---------------------------------------------------------------------
-- OCUPACIÓN POR CANCHA
-- ---------------------------------------------------------------------
create or replace function public.ocupacion_por_cancha(
  p_desde date default (current_date - 30),
  p_hasta date default current_date
)
returns table (cancha_id bigint, cancha text, reservas bigint, ingresos bigint, ocupacion_pct numeric)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre::text,
         count(r.id) filter (where r.estado in ('confirmada','completada')),
         coalesce(sum(r.precio_total) filter (where r.estado in ('confirmada','completada')), 0)::bigint,
         round(
           count(r.id) filter (where r.estado in ('confirmada','completada'))::numeric
           / nullif((p_hasta - p_desde + 1) *
                    extract(epoch from (s.hora_cierre - s.hora_apertura)) / 3600, 0) * 100, 1)
    from canchas c
    join sedes s on s.id = c.sede_id
    left join reservas r on r.cancha_id = c.id and r.fecha between p_desde and p_hasta
   where c.sede_id = mi_sede() and c.activa
   group by c.id, c.nombre, s.hora_cierre, s.hora_apertura
   order by 3 desc;
$$;

-- ---------------------------------------------------------------------
-- ZONAS MUERTAS  (lo que pidió Diana Marcela)
-- ---------------------------------------------------------------------
-- Las franjas vacías no aparecen en un GROUP BY normal justamente porque
-- están vacías. Por eso se genera el producto cancha × día × hora y se
-- cruza con las reservas reales: las que quedan en cero son las muertas.
-- ---------------------------------------------------------------------
create or replace function public.zonas_muertas(p_dias int default 60)
returns table (cancha text, dia_semana int, hora time, reservas bigint)
language sql stable security definer set search_path = public as $$
  with franjas as (
    select c.id as cancha_id, c.nombre, d.dia, gs::time as hora
      from canchas c
      join sedes s on s.id = c.sede_id
      cross join generate_series(0, 6) as d(dia)
      cross join lateral generate_series(
            current_date + s.hora_apertura,
            current_date + s.hora_cierre - interval '1 hour',
            interval '1 hour'
          ) as gs
     where c.sede_id = mi_sede() and c.activa
  ),
  usos as (
    select r.cancha_id, extract(dow from r.fecha)::int as dia, r.hora_inicio as hora, count(*) as n
      from reservas r join canchas c on c.id = r.cancha_id
     where c.sede_id = mi_sede()
       and r.fecha between current_date - p_dias and current_date
       and r.estado in ('confirmada','completada')
     group by 1, 2, 3
  )
  select f.nombre::text, f.dia, f.hora, coalesce(u.n, 0)
    from franjas f
    left join usos u on u.cancha_id = f.cancha_id and u.dia = f.dia and u.hora = f.hora
   order by coalesce(u.n, 0) asc, f.nombre, f.dia, f.hora
   limit 20;
$$;

-- ---------------------------------------------------------------------
-- REGISTRAR UN ESTABLECIMIENTO  (reemplaza POST /api/sedes/registro)
-- ---------------------------------------------------------------------
-- Crea la sede y convierte al usuario actual en su administrador. Las dos
-- cosas juntas o ninguna: si falla la segunda, no queda una sede huérfana.
-- ---------------------------------------------------------------------
create or replace function public.registrar_establecimiento(
  p_nombre        varchar(80),
  p_direccion     varchar(200),
  p_telefono      varchar(30),
  p_descripcion   text        default null,
  p_color_hex     varchar(7)  default '#2563EB',
  p_hora_apertura time        default '06:00',
  p_hora_cierre   time        default '23:00'
)
returns public.sedes
language plpgsql security definer set search_path = public as $$
declare v_slug text; v_sede public.sedes;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión primero.' using errcode = 'P0001';
  end if;
  if mi_sede() is not null then
    raise exception 'Tu cuenta ya administra un establecimiento.' using errcode = 'P0005';
  end if;

  v_slug := regexp_replace(
              lower(translate(p_nombre, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN')),
              '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  insert into sedes (nombre, slug, descripcion, direccion, telefono,
                     color_hex, hora_apertura, hora_cierre)
  values (p_nombre, v_slug, p_descripcion, p_direccion, p_telefono,
          p_color_hex, p_hora_apertura, p_hora_cierre)
  returning * into v_sede;

  update perfiles set rol = 'admin_sede', sede_id = v_sede.id
   where id = auth.uid();

  return v_sede;
end; $$;

-- ---------------------------------------------------------------------
-- REGISTRAR RESULTADO DE TORNEO
-- ---------------------------------------------------------------------
create or replace function public.registrar_resultado(
  p_equipo_local     bigint,
  p_equipo_visitante bigint,
  p_goles_local      int,
  p_goles_visitante  int
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_torneo bigint; v_sede bigint; v_pl int; v_pv int;
begin
  if p_equipo_local = p_equipo_visitante then
    raise exception 'Un equipo no puede jugar contra sí mismo.' using errcode = 'P0008';
  end if;

  select i.torneo_id, t.sede_id into v_torneo, v_sede
    from inscripciones_torneos i join torneos t on t.id = i.torneo_id
   where i.id = p_equipo_local;

  if not found or not administro_sede(v_sede) then
    raise exception 'No puedes registrar resultados de este torneo.' using errcode = 'P0006';
  end if;
  if not exists (select 1 from inscripciones_torneos
                  where id = p_equipo_visitante and torneo_id = v_torneo) then
    raise exception 'Los dos equipos deben ser del mismo torneo.' using errcode = 'P0008';
  end if;

  v_pl := case when p_goles_local > p_goles_visitante then 3
               when p_goles_local = p_goles_visitante then 1 else 0 end;
  v_pv := case when p_goles_visitante > p_goles_local then 3
               when p_goles_local = p_goles_visitante then 1 else 0 end;

  update inscripciones_torneos
     set puntos = puntos + v_pl, goles_favor = goles_favor + p_goles_local,
         goles_contra = goles_contra + p_goles_visitante
   where id = p_equipo_local;

  update inscripciones_torneos
     set puntos = puntos + v_pv, goles_favor = goles_favor + p_goles_visitante,
         goles_contra = goles_contra + p_goles_local
   where id = p_equipo_visitante;

  update torneos set estado = 'en_curso'
   where id = v_torneo and estado in ('inscripciones','cerrado');
end; $$;

-- ---------------------------------------------------------------------
-- VISTA: TABLA DE POSICIONES
-- ---------------------------------------------------------------------
create or replace view public.v_tabla_torneo as
select i.torneo_id, i.id as equipo_id, i.nombre_equipo,
       i.puntos, i.goles_favor, i.goles_contra,
       (i.goles_favor - i.goles_contra) as diferencia,
       row_number() over (
         partition by i.torneo_id
         order by i.puntos desc, (i.goles_favor - i.goles_contra) desc,
                  i.goles_favor desc, i.nombre_equipo asc
       ) as posicion
  from inscripciones_torneos i;

-- ---------------------------------------------------------------------
-- PERMISOS DE EJECUCIÓN
-- ---------------------------------------------------------------------
grant execute on function public.crear_reserva            to authenticated;
grant execute on function public.cancelar_reserva         to authenticated;
grant execute on function public.disponibilidad_cancha    to anon, authenticated;
grant execute on function public.metricas_sede            to authenticated;
grant execute on function public.ocupacion_por_cancha     to authenticated;
grant execute on function public.zonas_muertas            to authenticated;
grant execute on function public.registrar_establecimiento to authenticated;
grant execute on function public.registrar_resultado      to authenticated;
grant select on public.v_tabla_torneo to anon, authenticated;
