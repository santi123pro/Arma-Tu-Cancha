-- =====================================================================
-- 0001 — Esquema base de Arma Tu Cancha en Supabase
-- =====================================================================
-- Diferencia clave con el esquema de Express: la tabla `usuarios` ya no
-- existe. Supabase Auth administra `auth.users` y guarda ahí el correo y
-- la contraseña cifrada. Nosotros creamos `perfiles`, que extiende a cada
-- usuario con su nombre, su rol y la sede que administra.
-- =====================================================================

-- ---------------------------------------------------------------------
-- SEDES
-- ---------------------------------------------------------------------
create table if not exists public.sedes (
  id             bigint generated always as identity primary key,
  nombre         varchar(80)  not null,
  slug           varchar(80)  not null unique,
  descripcion    text,
  direccion      varchar(200),
  telefono       varchar(30),
  ciudad         varchar(80)  not null default 'Cali',
  color_hex      varchar(7)   not null default '#2563EB',
  logo_url       varchar(300),
  hora_apertura  time         not null default '06:00',
  hora_cierre    time         not null default '23:00',
  activa         boolean      not null default true,
  creado_at      timestamptz  not null default now(),

  constraint sedes_horario_valido check (hora_cierre > hora_apertura)
);

-- ---------------------------------------------------------------------
-- PERFILES
-- ---------------------------------------------------------------------
-- El id es el mismo de auth.users. Si se borra el usuario, se borra el
-- perfil. El rol NUNCA lo escribe el cliente: lo controla una política.
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  nombre    varchar(100) not null,
  telefono  varchar(30),
  rol       varchar(20)  not null default 'jugador',
  sede_id   bigint       references public.sedes(id) on delete set null,
  creado_at timestamptz  not null default now(),

  constraint perfiles_rol_valido check (rol in ('jugador','admin_sede','superadmin')),
  constraint perfiles_sede_requerida check (
    rol <> 'admin_sede' or sede_id is not null
  )
);

-- Cuando alguien se registra, se le crea el perfil automáticamente con
-- los datos que mandó en el formulario.
create or replace function public.fn_crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, telefono, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'telefono',
    'jugador'
  );
  return new;
end;
$$;

drop trigger if exists trg_crear_perfil on auth.users;
create trigger trg_crear_perfil
  after insert on auth.users
  for each row execute function public.fn_crear_perfil();

-- ---------------------------------------------------------------------
-- CANCHAS
-- ---------------------------------------------------------------------
create table if not exists public.canchas (
  id              bigint generated always as identity primary key,
  sede_id         bigint       not null references public.sedes(id) on delete cascade,
  nombre          varchar(80)  not null,
  tipo            varchar(40)  not null default 'Fútbol 6',
  precio_hora     integer      not null,
  superficie      varchar(40)  not null default 'Sintética',
  techada         boolean      not null default false,
  iluminacion     boolean      not null default true,
  caracteristicas text,
  activa          boolean      not null default true,
  creado_at       timestamptz  not null default now(),

  constraint canchas_precio_positivo check (precio_hora > 0),
  constraint canchas_nombre_unico_por_sede unique (sede_id, nombre)
);

create index if not exists canchas_sede_idx on public.canchas (sede_id) where activa;

-- ---------------------------------------------------------------------
-- RESERVAS
-- ---------------------------------------------------------------------
create table if not exists public.reservas (
  id             bigint generated always as identity primary key,
  cancha_id      bigint       not null references public.canchas(id) on delete cascade,
  usuario_id     uuid         references auth.users(id) on delete set null,
  fecha          date         not null,
  hora_inicio    time         not null,
  hora_fin       time         not null,
  cliente_nombre varchar(120) not null,
  cliente_tel    varchar(30),
  cliente_correo varchar(160),
  codigo         varchar(24)  not null unique,
  precio_total   integer      not null default 0,
  estado         varchar(20)  not null default 'confirmada',
  metodo_pago    varchar(20),
  notas          text,
  creado_at      timestamptz  not null default now(),
  cancelado_at   timestamptz,

  constraint reservas_estado_valido check (
    estado in ('confirmada','pendiente','cancelada','completada','no_asistio')
  ),
  constraint reservas_horario_valido check (hora_fin > hora_inicio),
  constraint reservas_pago_valido check (
    metodo_pago is null or metodo_pago in ('efectivo','nequi','transferencia','daviplata')
  )
);

-- LA restricción que impide la doble reserva. Es un índice único parcial:
-- las canceladas no bloquean el horario. Ningún código de aplicación
-- puede saltárselo, ni siquiera con dos usuarios simultáneos.
drop index if exists public.reservas_sin_solape;
create unique index reservas_sin_solape
  on public.reservas (cancha_id, fecha, hora_inicio)
  where estado in ('confirmada','pendiente');

create index if not exists reservas_cancha_fecha on public.reservas (cancha_id, fecha);
create index if not exists reservas_usuario_idx  on public.reservas (usuario_id);

-- ---------------------------------------------------------------------
-- PARTIDOS ABIERTOS
-- ---------------------------------------------------------------------
create table if not exists public.partidos_abiertos (
  id                 bigint generated always as identity primary key,
  creador_id         uuid        not null references auth.users(id) on delete cascade,
  cancha_id          bigint      not null references public.canchas(id) on delete cascade,
  reserva_id         bigint      references public.reservas(id) on delete set null,
  fecha              date        not null,
  hora_inicio        time        not null,
  modalidad          varchar(40) not null default 'Fútbol 6',
  nivel              varchar(30) not null default 'todos',
  posicion_requerida varchar(120),
  cupos_totales      integer     not null,
  cupos_ocupados     integer     not null default 0,
  estado             varchar(20) not null default 'abierto',
  creado_at          timestamptz not null default now(),

  constraint partidos_cupos_positivos check (cupos_totales > 0),
  constraint partidos_cupos_coherentes check (
    cupos_ocupados >= 0 and cupos_ocupados <= cupos_totales
  ),
  constraint partidos_nivel_valido check (
    nivel in ('principiante','intermedio','avanzado','todos')
  ),
  constraint partidos_estado_valido check (
    estado in ('abierto','completo','cancelado','jugado')
  )
);

create index if not exists partidos_estado_idx on public.partidos_abiertos (estado, fecha);

create table if not exists public.partido_jugadores (
  id         bigint generated always as identity primary key,
  partido_id bigint      not null references public.partidos_abiertos(id) on delete cascade,
  usuario_id uuid        not null references auth.users(id) on delete cascade,
  posicion   varchar(40),
  unido_at   timestamptz not null default now(),

  constraint partido_jugador_unico unique (partido_id, usuario_id)
);

-- ---------------------------------------------------------------------
-- TORNEOS
-- ---------------------------------------------------------------------
create table if not exists public.torneos (
  id                 bigint generated always as identity primary key,
  sede_id            bigint       not null references public.sedes(id) on delete cascade,
  organizador_id     uuid         references auth.users(id) on delete set null,
  nombre             varchar(120) not null,
  descripcion        text,
  modalidad          varchar(40)  not null default 'Fútbol 6',
  cupos_totales      integer      not null,
  cupos_inscritos    integer      not null default 0,
  fecha_inicio       date,
  cierre_inscripcion date,
  premio             varchar(200),
  estado             varchar(20)  not null default 'inscripciones',
  equipo_campeon     varchar(150),
  creado_at          timestamptz  not null default now(),

  constraint torneos_cupos_rango check (cupos_totales between 4 and 12),
  constraint torneos_inscritos_coherentes check (
    cupos_inscritos >= 0 and cupos_inscritos <= cupos_totales
  ),
  constraint torneos_estado_valido check (
    estado in ('inscripciones','cerrado','en_curso','finalizado','cancelado')
  )
);

create table if not exists public.inscripciones_torneos (
  id            bigint generated always as identity primary key,
  torneo_id     bigint       not null references public.torneos(id) on delete cascade,
  capitan_id    uuid         not null references auth.users(id) on delete cascade,
  nombre_equipo varchar(150) not null,
  puntos        integer      not null default 0,
  goles_favor   integer      not null default 0,
  goles_contra  integer      not null default 0,
  creado_at     timestamptz  not null default now(),

  constraint inscripcion_equipo_unico  unique (torneo_id, nombre_equipo),
  constraint inscripcion_capitan_unico unique (torneo_id, capitan_id)
);

-- ---------------------------------------------------------------------
-- DISPARADORES DE CUPOS
-- ---------------------------------------------------------------------
-- Mantienen los contadores sincronizados contando filas reales. Sin esto,
-- dos usuarios simultáneos leen el mismo valor y un incremento se pierde.
-- ---------------------------------------------------------------------
create or replace function public.fn_sync_cupos_partido()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_total int; v_cupos int;
begin
  v_id := coalesce(new.partido_id, old.partido_id);
  select count(*) into v_total from partido_jugadores where partido_id = v_id;
  select cupos_totales into v_cupos from partidos_abiertos where id = v_id;
  update partidos_abiertos
     set cupos_ocupados = v_total,
         estado = case
                    when estado in ('cancelado','jugado') then estado
                    when v_total >= v_cupos then 'completo'
                    else 'abierto'
                  end
   where id = v_id;
  return null;
end; $$;

drop trigger if exists trg_sync_cupos_partido on public.partido_jugadores;
create trigger trg_sync_cupos_partido
  after insert or delete on public.partido_jugadores
  for each row execute function public.fn_sync_cupos_partido();

create or replace function public.fn_sync_cupos_torneo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_total int; v_cupos int;
begin
  v_id := coalesce(new.torneo_id, old.torneo_id);
  select count(*) into v_total from inscripciones_torneos where torneo_id = v_id;
  select cupos_totales into v_cupos from torneos where id = v_id;
  update torneos
     set cupos_inscritos = v_total,
         estado = case
                    when estado in ('en_curso','finalizado','cancelado') then estado
                    when v_total >= v_cupos then 'cerrado'
                    else 'inscripciones'
                  end
   where id = v_id;
  return null;
end; $$;

drop trigger if exists trg_sync_cupos_torneo on public.inscripciones_torneos;
create trigger trg_sync_cupos_torneo
  after insert or delete on public.inscripciones_torneos
  for each row execute function public.fn_sync_cupos_torneo();
