-- ═══════════════════════════════════════════════════════════════════
-- 0010_correcciones.sql
--
-- Corrige cinco fallas encontradas probando la base con los tres roles
-- (jugador, admin_sede, superadmin) contra un PostgreSQL real.
--
--  1. Las reservas se podían solapar: el índice solo comparaba la hora
--     de inicio exacta, así que 19:00-21:00 y 20:00-21:00 convivían.
--  2. Un jugador podía insertar reservas directamente, saltándose
--     crear_reserva() y todas sus reglas (precio, 15 días, horario).
--  3. Un jugador podía editar su propia reserva: cambiarse el precio,
--     la fecha o la hora después de creada.
--  4. Cualquier usuario podía crear sedes, que salían publicadas en el
--     catálogo.
--  5. El administrador no veía el nombre de los jugadores que
--     reservaron en su sede.
--
-- Es idempotente: se puede correr varias veces.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- 1. SOLAPE REAL DE RESERVAS
-- ───────────────────────────────────────────────────────────────────
-- Un índice único sobre (cancha, fecha, hora_inicio) solo impide dos
-- reservas que ARRANCAN a la misma hora. No ve que una reserva de
-- 19:00 a 21:00 pisa a otra de 20:00 a 21:00.
--
-- La restricción de exclusión sí compara intervalos completos. El
-- rango va '[)' — abierto al final — para que una reserva de 21:00 a
-- 22:00 pueda ir pegada a la de 20:00 a 21:00 sin chocar.
-- ───────────────────────────────────────────────────────────────────

create extension if not exists btree_gist;

do $$
declare v_conflictos int;
begin
  select count(*) into v_conflictos
    from reservas a
    join reservas b
      on a.id < b.id
     and a.cancha_id = b.cancha_id
     and a.fecha = b.fecha
     and a.estado in ('confirmada','pendiente')
     and b.estado in ('confirmada','pendiente')
     and tsrange(a.fecha + a.hora_inicio, a.fecha + a.hora_fin, '[)')
      && tsrange(b.fecha + b.hora_inicio, b.fecha + b.hora_fin, '[)');

  if v_conflictos > 0 then
    raise notice 'Hay % pares de reservas que ya se solapan. Se cancela la más reciente de cada par.', v_conflictos;

    update reservas b
       set estado = 'cancelada', cancelado_at = now()
      from reservas a
     where a.id < b.id
       and a.cancha_id = b.cancha_id
       and a.fecha = b.fecha
       and a.estado in ('confirmada','pendiente')
       and b.estado in ('confirmada','pendiente')
       and tsrange(a.fecha + a.hora_inicio, a.fecha + a.hora_fin, '[)')
        && tsrange(b.fecha + b.hora_inicio, b.fecha + b.hora_fin, '[)');
  end if;
end $$;

alter table public.reservas drop constraint if exists reservas_sin_solape_real;

alter table public.reservas
  add constraint reservas_sin_solape_real
  exclude using gist (
    cancha_id with =,
    tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') with &&
  ) where (estado in ('confirmada','pendiente'));

-- El índice viejo se queda: no estorba y cubre el caso exacto más rápido.


-- ───────────────────────────────────────────────────────────────────
-- 2 y 3. LAS RESERVAS SOLO SE TOCAN POR LAS FUNCIONES
-- ───────────────────────────────────────────────────────────────────
-- crear_reserva() y cancelar_reserva() son `security definer`: corren
-- como el dueño de la base, así que no les aplica el RLS. Por eso se
-- le puede quitar al jugador el permiso directo sin romper nada — y
-- así queda obligado a pasar por las validaciones.
--
-- El administrador sí conserva el acceso directo, porque necesita
-- confirmar, marcar pagos y corregir datos desde su panel.
-- ───────────────────────────────────────────────────────────────────

drop policy if exists reservas_crear on public.reservas;
create policy reservas_crear on public.reservas
  for insert to authenticated
  with check (administro_cancha(cancha_id));

drop policy if exists reservas_actualizar on public.reservas;
create policy reservas_actualizar on public.reservas
  for update to authenticated
  using (administro_cancha(cancha_id))
  with check (administro_cancha(cancha_id));

-- Leer no cambia: el jugador ve las suyas, el admin las de su sede.


-- ───────────────────────────────────────────────────────────────────
-- 4. REGISTRAR SEDES
-- ───────────────────────────────────────────────────────────────────
-- Antes: `with check (true)`. Cualquier jugador podía insertar una sede
-- y aparecía publicada en el catálogo.
--
-- Ahora el alta pasa por registrar_establecimiento(), que es
-- `security definer` y además convierte al solicitante en admin_sede.
-- El insert directo queda solo para el superadmin.
-- ───────────────────────────────────────────────────────────────────

drop policy if exists sedes_crear on public.sedes;
create policy sedes_crear on public.sedes
  for insert to authenticated
  with check (es_superadmin());


-- ───────────────────────────────────────────────────────────────────
-- 5. EL ADMIN VE A SUS CLIENTES
-- ───────────────────────────────────────────────────────────────────
-- Un jugador tiene sede_id nulo, así que administro_sede(sede_id) nunca
-- se cumplía y el panel no podía mostrar el nombre de quien reservó.
-- Se agrega el caso: el admin ve el perfil de quien tiene actividad en
-- su sede (una reserva, un partido publicado o un cupo tomado).
-- ───────────────────────────────────────────────────────────────────

drop policy if exists perfiles_ver_propio on public.perfiles;
create policy perfiles_ver_propio on public.perfiles
  for select to authenticated
  using (
    id = auth.uid()
    or administro_sede(sede_id)
    or es_superadmin()
    or exists (
      select 1 from reservas r
       where r.usuario_id = perfiles.id
         and administro_cancha(r.cancha_id)
    )
    or exists (
      select 1 from partidos_abiertos p
       where p.creador_id = perfiles.id
         and administro_cancha(p.cancha_id)
    )
    or exists (
      select 1 from partido_jugadores pj
       join partidos_abiertos p on p.id = pj.partido_id
      where pj.usuario_id = perfiles.id
        and administro_cancha(p.cancha_id)
    )
  );


-- ───────────────────────────────────────────────────────────────────
-- 6. NO UNIRSE A PARTIDOS CANCELADOS NI PASADOS
-- ───────────────────────────────────────────────────────────────────
drop policy if exists pj_unirse on public.partido_jugadores;
create policy pj_unirse on public.partido_jugadores
  for insert to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1 from partidos_abiertos p
       where p.id = partido_id
         and p.estado = 'abierto'
         and (p.fecha + p.hora_inicio) > (now() at time zone 'America/Bogota')
    )
  );


-- ───────────────────────────────────────────────────────────────────
-- 7. MODALIDAD CON VALORES CERRADOS
-- ───────────────────────────────────────────────────────────────────
-- Era texto libre. Permitía guardar cualquier cosa, incluido HTML, y
-- hacía imposible agrupar por modalidad en los reportes.
-- ───────────────────────────────────────────────────────────────────

update public.partidos_abiertos
   set modalidad = 'Fútbol 6'
 where modalidad not in ('Fútbol 5','Fútbol 6','Fútbol 7','Fútbol 8','Fútbol 11');

alter table public.partidos_abiertos drop constraint if exists partidos_modalidad_valida;
alter table public.partidos_abiertos
  add constraint partidos_modalidad_valida
  check (modalidad in ('Fútbol 5','Fútbol 6','Fútbol 7','Fútbol 8','Fútbol 11'));

alter table public.partidos_abiertos drop constraint if exists partidos_posicion_valida;
alter table public.partidos_abiertos
  add constraint partidos_posicion_valida
  check (posicion_requerida is null
         or posicion_requerida in ('Arquero','Defensa','Mediocampista','Delantero'));


-- ───────────────────────────────────────────────────────────────────
-- 8. DISPONIBILIDAD QUE RESPETA LAS RESERVAS LARGAS
-- ───────────────────────────────────────────────────────────────────
-- La versión anterior cruzaba por hora_inicio exacta, así que una
-- reserva de 19:00 a 21:00 solo pintaba ocupada la franja de las 19:00
-- y dejaba las 20:00 libre en pantalla.
-- Ahora se compara el intervalo completo de cada franja.
-- ───────────────────────────────────────────────────────────────────

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
  )
  select f.inicio,
         f.fin,
         (not exists (
            select 1 from reservas r
             where r.cancha_id = p_cancha_id
               and r.fecha = p_fecha
               and r.estado in ('confirmada','pendiente')
               and tsrange(r.fecha + r.hora_inicio, r.fecha + r.hora_fin, '[)')
                && tsrange(p_fecha + f.inicio,      p_fecha + f.fin,      '[)')
          )
          and (p_fecha > current_date or f.inicio > current_time)) as disponible,
         (select precio_hora from cancha)
    from franjas f
   order by f.inicio;
$$;

alter function public.disponibilidad_cancha(bigint, date)
  set timezone = 'America/Bogota';
