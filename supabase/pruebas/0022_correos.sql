-- =====================================================================
-- Prueba de la migración 0022. Todo se revierte con el ROLLBACK final.
-- Si un assert falla, la ejecución termina con error y nada queda guardado.
-- Usa fechas de 2099 para no chocar con reservas reales.
-- =====================================================================
begin;

create function pg_temp.nueva_reserva(p_dia int, p_estado text default 'pendiente', p_usuario uuid default null)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  insert into public.reservas (
    cancha_id, usuario_id, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_correo,
    codigo, precio_total, estado, pago_estado
  ) values (
    (select id from public.canchas order by id limit 1),
    coalesce(p_usuario, (select id from auth.users order by created_at limit 1)),
    date '2099-01-01' + p_dia, '19:00', '20:00', 'Persona de prueba', 'otra@ejemplo.invalid',
    'PRUEBA-' || p_dia, 100000, p_estado,
    case when p_estado = 'pendiente' then 'esperando_pago' else 'aprobado' end
  ) returning id into v_id;
  return v_id;
end $$;

create function pg_temp.filas(p_reserva bigint)
returns bigint language sql as $$
  select count(*) from public.correos_reserva where reserva_id = p_reserva
$$;

create function pg_temp.estado(p_reserva bigint)
returns text language sql as $$
  select estado from public.correos_reserva where reserva_id = p_reserva
$$;

-- El trigger solo reacciona a pendiente -> confirmada, y una sola vez.
do $$
declare r bigint;
begin
  r := pg_temp.nueva_reserva(1);
  assert pg_temp.filas(r) = 0, 'una reserva pendiente no debe encolar';

  update public.reservas set estado = 'confirmada' where id = r;
  assert pg_temp.filas(r) = 1, 'pendiente -> confirmada debe encolar';
  assert pg_temp.estado(r) = 'pendiente', 'la fila nueva debe quedar pendiente';

  update public.reservas set estado = 'pendiente' where id = r;
  update public.reservas set estado = 'confirmada' where id = r;
  assert pg_temp.filas(r) = 1, 'repetir el cambio no debe duplicar';

  r := pg_temp.nueva_reserva(2, 'confirmada');
  assert pg_temp.filas(r) = 0, 'una reserva creada ya confirmada no debe encolar';

  r := pg_temp.nueva_reserva(3);
  update public.reservas set estado = 'cancelada' where id = r;
  assert pg_temp.filas(r) = 0, 'pendiente -> cancelada no debe encolar';
end $$;

-- Tomar correos: destinatario, bloqueo y omitidos.
do $$
declare
  r bigint; u uuid; correo_cuenta text; v record;
begin
  select id, email into u, correo_cuenta from auth.users where email is not null order by created_at limit 1;

  r := pg_temp.nueva_reserva(4, 'pendiente', u);
  update public.reservas set estado = 'confirmada' where id = r;

  select * into v from public.tomar_correos_reserva(100) t where t.reserva_id = r;
  assert v.destinatario = correo_cuenta, 'el destinatario debe ser el correo de la cuenta';
  assert v.codigo = 'PRUEBA-4' and v.nombre = 'Persona de prueba' and v.precio_total = 100000, 'datos del correo incompletos';
  assert v.sede is not null and v.cancha is not null and v.fecha = date '2099-01-05', 'faltan sede, cancha o fecha';
  assert pg_temp.estado(r) = 'enviando', 'la fila tomada debe quedar enviando';
  assert (select intentos from public.correos_reserva where reserva_id = r) = 1, 'debe sumar un intento';

  assert not exists (select 1 from public.tomar_correos_reserva(100) t where t.reserva_id = r),
    'una segunda llamada no debe devolver la misma fila';

  -- Cancelada antes de enviarse.
  r := pg_temp.nueva_reserva(5);
  update public.reservas set estado = 'confirmada' where id = r;
  update public.reservas set estado = 'cancelada' where id = r;
  assert not exists (select 1 from public.tomar_correos_reserva(100) t where t.reserva_id = r),
    'una reserva cancelada no debe devolverse';
  assert pg_temp.estado(r) = 'omitido', 'una reserva cancelada debe quedar omitida';

  -- Cuenta eliminada.
  r := pg_temp.nueva_reserva(6);
  update public.reservas set estado = 'confirmada' where id = r;
  update public.reservas set usuario_id = null where id = r;
  assert not exists (select 1 from public.tomar_correos_reserva(100) t where t.reserva_id = r),
    'una reserva sin cuenta no debe devolverse';
  assert pg_temp.estado(r) = 'omitido', 'una reserva sin cuenta debe quedar omitida';
end $$;

-- Marcar: esperas de 1, 5, 15 y 60 minutos, y luego fallido.
do $$
declare r bigint; c bigint; n int; espera int; prox timestamptz;
begin
  r := pg_temp.nueva_reserva(7);
  update public.reservas set estado = 'confirmada' where id = r;
  select id into c from public.correos_reserva where reserva_id = r;

  foreach espera in array array[1, 5, 15, 60] loop
    n := array_position(array[1, 5, 15, 60], espera);
    update public.correos_reserva set estado = 'enviando', intentos = n where id = c;
    perform public.marcar_correo_reserva(c, false, 'x');
    select proximo_intento_at into prox from public.correos_reserva where id = c;
    assert pg_temp.estado(r) = 'pendiente', 'un fallo con intentos restantes debe volver a pendiente';
    assert prox between now() + (espera - 1) * interval '1 minute' and now() + (espera + 1) * interval '1 minute',
      format('la espera del intento %s debe ser de %s minutos', n, espera);
  end loop;

  update public.correos_reserva set estado = 'enviando', intentos = 5 where id = c;
  perform public.marcar_correo_reserva(c, false, 'x');
  assert pg_temp.estado(r) = 'fallido', 'el quinto fallo debe quedar fallido';
  assert (select ultimo_error from public.correos_reserva where id = c) = 'x', 'debe guardar el error';

  update public.correos_reserva set estado = 'enviando', intentos = 1, ultimo_error = 'x' where id = c;
  perform public.marcar_correo_reserva(c, true);
  assert pg_temp.estado(r) = 'enviado', 'un envío correcto debe quedar enviado';
  assert (select enviado_at is not null from public.correos_reserva where id = c), 'debe guardar enviado_at';
end $$;

-- Filas abandonadas en "enviando".
do $$
declare r bigint;
begin
  r := pg_temp.nueva_reserva(8);
  update public.reservas set estado = 'confirmada' where id = r;
  update public.correos_reserva
     set estado = 'enviando', intentos = 2, bloqueado_hasta = now() - interval '1 minute'
   where reserva_id = r;
  assert exists (select 1 from public.tomar_correos_reserva(100) t where t.reserva_id = r),
    'una fila abandonada debe volver a tomarse';

  r := pg_temp.nueva_reserva(9);
  update public.reservas set estado = 'confirmada' where id = r;
  update public.correos_reserva
     set estado = 'enviando', intentos = 5, bloqueado_hasta = now() - interval '1 minute'
   where reserva_id = r;
  assert not exists (select 1 from public.tomar_correos_reserva(100) t where t.reserva_id = r),
    'una fila abandonada sin intentos no debe tomarse';
  assert pg_temp.estado(r) = 'fallido', 'una fila abandonada sin intentos debe quedar fallida';
end $$;

-- Permisos: la app no puede leer la cola ni ejecutar estas funciones.
do $$
begin
  assert not has_table_privilege('authenticated', 'public.correos_reserva', 'select'), 'authenticated no debe leer la cola';
  assert not has_table_privilege('anon', 'public.correos_reserva', 'select'), 'anon no debe leer la cola';
  assert (select relrowsecurity from pg_class where oid = 'public.correos_reserva'::regclass), 'la cola debe tener RLS';
  assert not has_function_privilege('authenticated', 'public.tomar_correos_reserva(int)', 'execute'), 'authenticated no debe tomar correos';
  assert not has_function_privilege('anon', 'public.tomar_correos_reserva(int)', 'execute'), 'anon no debe tomar correos';
  assert not has_function_privilege('authenticated', 'public.marcar_correo_reserva(bigint, boolean, text)', 'execute'), 'authenticated no debe marcar correos';
  assert not has_function_privilege('anon', 'public.marcar_correo_reserva(bigint, boolean, text)', 'execute'), 'anon no debe marcar correos';
  assert not has_function_privilege('authenticated', 'public.disparar_correos_reserva()', 'execute'), 'authenticated no debe disparar envíos';
  assert has_function_privilege('service_role', 'public.tomar_correos_reserva(int)', 'execute'), 'service_role debe tomar correos';
  assert has_function_privilege('service_role', 'public.marcar_correo_reserva(bigint, boolean, text)', 'execute'), 'service_role debe marcar correos';
end $$;

rollback;
