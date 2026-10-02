-- =====================================================================
-- 0009 — Métricas del administrador de sede
-- =====================================================================
-- metricas_globales() (0007) es solo para el superadmin y mira todo el
-- negocio. Esta devuelve lo mismo pero recortado a la sede del admin que
-- llama. La sede sale de mi_sede(): el navegador no la elige, así que un
-- admin no puede pedir las métricas de otra sede.
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

drop function if exists public.metricas_mi_sede(date, date);

create function public.metricas_mi_sede(
  p_desde date default (current_date - 30),
  p_hasta date default current_date
)
returns json
language plpgsql stable security definer
set search_path = public
set timezone = 'America/Bogota'
as $$
declare
  v_sede bigint := mi_sede();
  v_res  json;
begin
  if mi_rol() <> 'admin_sede' or v_sede is null then
    raise exception 'Tu cuenta no administra ningún establecimiento.' using errcode = 'P0006';
  end if;

  with rango as (
    select r.*, c.nombre as cancha
      from reservas r join canchas c on c.id = r.cancha_id
     where c.sede_id = v_sede and r.fecha between p_desde and p_hasta
  ),
  validas as (
    select * from rango where estado in ('confirmada', 'completada')
  )
  select json_build_object(
    'desde', p_desde,
    'hasta', p_hasta,
    'sede',  (select json_build_object('id', s.id, 'nombre', s.nombre) from sedes s where s.id = v_sede),

    'resumen', json_build_object(
      'reservas',          (select count(*) from validas),
      'canceladas',        (select count(*) from rango where estado = 'cancelada'),
      'ingresos',          (select coalesce(sum(precio_total), 0) from validas),
      'reservas_hoy',      (select count(*) from reservas r join canchas c on c.id = r.cancha_id
                             where c.sede_id = v_sede and r.fecha = current_date
                               and r.estado in ('confirmada', 'pendiente')),
      'clientes',          (select count(distinct coalesce(usuario_id::text, cliente_nombre)) from validas),
      'partidos_abiertos', (select count(*) from partidos_abiertos p join canchas c on c.id = p.cancha_id
                             where c.sede_id = v_sede and p.estado = 'abierto' and p.fecha >= current_date),
      'torneos_activos',   (select count(*) from torneos
                             where sede_id = v_sede and estado in ('inscripciones', 'cerrado', 'en_curso'))
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

    -- Todas las canchas activas de la sede, aunque no tengan reservas.
    'por_cancha', (
      select coalesce(json_agg(x order by x.reservas desc, x.cancha), '[]'::json)
        from (
          select c.nombre as cancha,
                 count(v.id) as reservas,
                 coalesce(sum(v.precio_total), 0) as ingresos
            from canchas c
            left join validas v on v.cancha_id = c.id
           where c.sede_id = v_sede and c.activa
           group by c.id, c.nombre
        ) x
    )
  ) into v_res;

  return v_res;
end; $$;

revoke execute on function public.metricas_mi_sede(date, date) from public, anon;
grant  execute on function public.metricas_mi_sede(date, date) to authenticated;
