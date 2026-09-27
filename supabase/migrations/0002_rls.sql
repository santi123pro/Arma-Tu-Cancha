-- =====================================================================
-- 0002 — Seguridad a nivel de fila (RLS)
-- =====================================================================
-- Esto reemplaza por completo a tu authMiddleware.js.
--
-- La diferencia de fondo: en Express, si olvidabas poner el middleware en
-- una ruta, esa ruta quedaba abierta. Con RLS la regla vive en la tabla,
-- así que da igual desde dónde llegue la consulta —React, Postman, el
-- editor SQL— siempre se aplica.
--
-- Cómo leer una política:
--   for select  → quién puede LEER filas
--   for insert  → quién puede CREAR filas (with check)
--   for update  → quién puede MODIFICAR filas (using + with check)
--   for delete  → quién puede BORRAR filas
--   using       → condición que deben cumplir las filas existentes
--   with check  → condición que debe cumplir la fila nueva o modificada
-- =====================================================================

-- ---------------------------------------------------------------------
-- FUNCIONES AUXILIARES
-- ---------------------------------------------------------------------
-- Van con `security definer` para que puedan leer la tabla perfiles sin
-- disparar las políticas de esa misma tabla (eso causaría recursión).
-- ---------------------------------------------------------------------

create or replace function public.mi_rol()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select rol from perfiles where id = auth.uid()), 'anonimo');
$$;

create or replace function public.mi_sede()
returns bigint language sql stable security definer set search_path = public as $$
  select sede_id from perfiles where id = auth.uid();
$$;

-- ¿El usuario actual administra esta sede?
create or replace function public.administro_sede(p_sede_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfiles
     where id = auth.uid()
       and (rol = 'superadmin' or (rol = 'admin_sede' and sede_id = p_sede_id))
  );
$$;

-- ¿El usuario actual administra la sede a la que pertenece esta cancha?
create or replace function public.administro_cancha(p_cancha_id bigint)
returns boolean language sql stable security definer set search_path = public as $$
  select administro_sede((select sede_id from canchas where id = p_cancha_id));
$$;

-- ---------------------------------------------------------------------
-- ACTIVAR RLS EN TODAS LAS TABLAS
-- ---------------------------------------------------------------------
-- Al activarlo sin políticas, la tabla queda cerrada para todos. Las
-- políticas de abajo van abriendo lo justo.
-- ---------------------------------------------------------------------
alter table public.sedes                 enable row level security;
alter table public.perfiles              enable row level security;
alter table public.canchas               enable row level security;
alter table public.reservas              enable row level security;
alter table public.partidos_abiertos     enable row level security;
alter table public.partido_jugadores     enable row level security;
alter table public.torneos               enable row level security;
alter table public.inscripciones_torneos enable row level security;

-- ---------------------------------------------------------------------
-- SEDES
-- ---------------------------------------------------------------------
drop policy if exists sedes_lectura_publica on public.sedes;
create policy sedes_lectura_publica on public.sedes
  for select using (activa or administro_sede(id));

-- Cualquiera autenticado puede registrar su establecimiento.
drop policy if exists sedes_crear on public.sedes;
create policy sedes_crear on public.sedes
  for insert to authenticated with check (true);

-- Solo su dueño la edita.
drop policy if exists sedes_editar on public.sedes;
create policy sedes_editar on public.sedes
  for update to authenticated
  using (administro_sede(id))
  with check (administro_sede(id));

-- ---------------------------------------------------------------------
-- PERFILES
-- ---------------------------------------------------------------------
drop policy if exists perfiles_ver_propio on public.perfiles;
create policy perfiles_ver_propio on public.perfiles
  for select to authenticated
  using (id = auth.uid() or administro_sede(sede_id) or mi_rol() = 'superadmin');

-- Cada quien edita su nombre y teléfono. El rol y la sede quedan
-- bloqueados: si el cliente intenta cambiarlos, la fila no pasa el check.
drop policy if exists perfiles_editar_propio on public.perfiles;
create policy perfiles_editar_propio on public.perfiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol = (select rol from perfiles where id = auth.uid())
    and sede_id is not distinct from (select sede_id from perfiles where id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- CANCHAS
-- ---------------------------------------------------------------------
-- El catálogo es público: un visitante sin cuenta puede ver qué hay.
drop policy if exists canchas_lectura_publica on public.canchas;
create policy canchas_lectura_publica on public.canchas
  for select using (activa or administro_sede(sede_id));

drop policy if exists canchas_crear on public.canchas;
create policy canchas_crear on public.canchas
  for insert to authenticated with check (administro_sede(sede_id));

drop policy if exists canchas_editar on public.canchas;
create policy canchas_editar on public.canchas
  for update to authenticated
  using (administro_sede(sede_id)) with check (administro_sede(sede_id));

-- ---------------------------------------------------------------------
-- RESERVAS
-- ---------------------------------------------------------------------
-- Un jugador ve solo las suyas. Un administrador ve las de su sede.
-- Esta es la regla que impide que el dueño de Bernabéu vea los clientes
-- de Wembley.
-- ---------------------------------------------------------------------
drop policy if exists reservas_ver on public.reservas;
create policy reservas_ver on public.reservas
  for select to authenticated
  using (usuario_id = auth.uid() or administro_cancha(cancha_id));

-- La creación va por la función crear_reserva (migración 0003), que valida
-- las reglas de negocio. Esta política permite el insert solo si el
-- usuario se pone a sí mismo como dueño de la reserva.
drop policy if exists reservas_crear on public.reservas;
create policy reservas_crear on public.reservas
  for insert to authenticated
  with check (usuario_id = auth.uid() or administro_cancha(cancha_id));

-- Cancelar es un update de estado. El jugador puede cancelar la suya; el
-- administrador cualquiera de su sede.
drop policy if exists reservas_actualizar on public.reservas;
create policy reservas_actualizar on public.reservas
  for update to authenticated
  using (usuario_id = auth.uid() or administro_cancha(cancha_id))
  with check (usuario_id = auth.uid() or administro_cancha(cancha_id));

-- ---------------------------------------------------------------------
-- PARTIDOS ABIERTOS
-- ---------------------------------------------------------------------
-- Son públicos por definición: el punto es que otros los vean y se unan.
drop policy if exists partidos_lectura_publica on public.partidos_abiertos;
create policy partidos_lectura_publica on public.partidos_abiertos
  for select using (true);

drop policy if exists partidos_crear on public.partidos_abiertos;
create policy partidos_crear on public.partidos_abiertos
  for insert to authenticated with check (creador_id = auth.uid());

drop policy if exists partidos_editar on public.partidos_abiertos;
create policy partidos_editar on public.partidos_abiertos
  for update to authenticated
  using (creador_id = auth.uid() or administro_cancha(cancha_id))
  with check (creador_id = auth.uid() or administro_cancha(cancha_id));

-- ---------------------------------------------------------------------
-- PARTIDO_JUGADORES
-- ---------------------------------------------------------------------
drop policy if exists pj_lectura on public.partido_jugadores;
create policy pj_lectura on public.partido_jugadores
  for select using (true);

-- Unirse = insertar una fila contigo mismo. La restricción UNIQUE impide
-- que te unas dos veces; el CHECK de cupos impide el sobrecupo.
drop policy if exists pj_unirse on public.partido_jugadores;
create policy pj_unirse on public.partido_jugadores
  for insert to authenticated with check (usuario_id = auth.uid());

drop policy if exists pj_salirse on public.partido_jugadores;
create policy pj_salirse on public.partido_jugadores
  for delete to authenticated using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------
-- TORNEOS
-- ---------------------------------------------------------------------
drop policy if exists torneos_lectura_publica on public.torneos;
create policy torneos_lectura_publica on public.torneos
  for select using (true);

drop policy if exists torneos_crear on public.torneos;
create policy torneos_crear on public.torneos
  for insert to authenticated with check (administro_sede(sede_id));

drop policy if exists torneos_editar on public.torneos;
create policy torneos_editar on public.torneos
  for update to authenticated
  using (administro_sede(sede_id)) with check (administro_sede(sede_id));

-- ---------------------------------------------------------------------
-- INSCRIPCIONES
-- ---------------------------------------------------------------------
drop policy if exists inscripciones_lectura on public.inscripciones_torneos;
create policy inscripciones_lectura on public.inscripciones_torneos
  for select using (true);

drop policy if exists inscripciones_crear on public.inscripciones_torneos;
create policy inscripciones_crear on public.inscripciones_torneos
  for insert to authenticated with check (capitan_id = auth.uid());

drop policy if exists inscripciones_retirar on public.inscripciones_torneos;
create policy inscripciones_retirar on public.inscripciones_torneos
  for delete to authenticated
  using (
    capitan_id = auth.uid()
    and (select estado from torneos where id = torneo_id) in ('inscripciones','cerrado')
  );

-- Solo el organizador registra resultados.
drop policy if exists inscripciones_resultados on public.inscripciones_torneos;
create policy inscripciones_resultados on public.inscripciones_torneos
  for update to authenticated
  using (administro_sede((select sede_id from torneos where id = torneo_id)))
  with check (administro_sede((select sede_id from torneos where id = torneo_id)));
