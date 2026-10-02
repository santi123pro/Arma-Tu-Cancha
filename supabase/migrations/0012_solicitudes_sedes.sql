-- =====================================================================
-- 0012 — Solicitudes de establecimientos ("Trabaja con nosotros")
-- =====================================================================
-- Dueños de canchas que quieren unirse a la plataforma llenan el
-- formulario de /aliados. La solicitud queda aquí y el superadmin la ve
-- en la pestaña "Solicitudes" del panel.
--
--  · Cualquiera (con o sin cuenta) puede ENVIAR una solicitud.
--  · Nadie más que el superadmin puede LEERLAS, cambiarlas o borrarlas.
--  · El mismo correo no puede enviar otra en menos de 10 minutos.
--
-- Se puede ejecutar varias veces sin romper nada.
-- Cómo correrlo: Supabase → SQL Editor → pegar todo → Run.
-- =====================================================================

create table if not exists public.solicitudes_sedes (
  id               bigint generated always as identity primary key,

  -- Contacto
  contacto_nombre  varchar(100) not null,
  contacto_cargo   varchar(60),
  correo           varchar(160) not null,
  telefono         varchar(30)  not null,

  -- Establecimiento
  establecimiento  varchar(120) not null,
  ciudad           varchar(80)  not null default 'Cali',
  direccion        varchar(200) not null,
  num_canchas      integer      not null,
  tipos_cancha     varchar(200),
  hora_apertura    time,
  hora_cierre      time,

  -- Datos de la empresa (opcionales)
  razon_social     varchar(150),
  nit              varchar(30),
  mensaje          text,

  -- Autorización de tratamiento de datos (Ley 1581 de 2012)
  acepta_datos     boolean      not null,

  -- Seguimiento del superadmin
  estado           varchar(20)  not null default 'nueva',
  notas_admin      text,
  creado_at        timestamptz  not null default now(),

  constraint solicitudes_acepta_datos check (acepta_datos),
  constraint solicitudes_correo_valido check (correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint solicitudes_canchas_rango check (num_canchas between 1 and 50),
  constraint solicitudes_mensaje_largo check (length(mensaje) <= 2000),
  constraint solicitudes_estado_valido check (
    estado in ('nueva', 'contactada', 'aprobada', 'descartada')
  )
);

create index if not exists solicitudes_sedes_creado_idx on public.solicitudes_sedes (creado_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.solicitudes_sedes enable row level security;

-- Enviar: cualquiera, pero solo como solicitud nueva y sin notas.
drop policy if exists solicitudes_enviar on public.solicitudes_sedes;
create policy solicitudes_enviar on public.solicitudes_sedes
  for insert to anon, authenticated
  with check (estado = 'nueva' and notas_admin is null);

drop policy if exists solicitudes_ver on public.solicitudes_sedes;
create policy solicitudes_ver on public.solicitudes_sedes
  for select to authenticated using (es_superadmin());

drop policy if exists solicitudes_editar on public.solicitudes_sedes;
create policy solicitudes_editar on public.solicitudes_sedes
  for update to authenticated
  using (es_superadmin()) with check (es_superadmin());

drop policy if exists solicitudes_borrar on public.solicitudes_sedes;
create policy solicitudes_borrar on public.solicitudes_sedes
  for delete to authenticated using (es_superadmin());

-- Permisos explícitos (por si el proyecto no expone las tablas nuevas solo).
revoke all on public.solicitudes_sedes from anon, authenticated;
grant insert on public.solicitudes_sedes to anon, authenticated;
grant select, update, delete on public.solicitudes_sedes to authenticated;

-- ---------------------------------------------------------------------
-- Antispam: el mismo correo no puede enviar otra en menos de 10 minutos.
-- Corre como dueño de la tabla porque quien envía no puede leerla.
-- ---------------------------------------------------------------------
create or replace function public.fn_solicitud_sin_repetir()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.correo := lower(trim(new.correo));
  if exists (
    select 1 from solicitudes_sedes
     where correo = new.correo
       and creado_at > now() - interval '10 minutes'
  ) then
    raise exception 'Ya recibimos tu solicitud. Te contactaremos pronto.' using errcode = 'P0011';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_solicitud_sin_repetir on public.solicitudes_sedes;
create trigger trg_solicitud_sin_repetir
  before insert on public.solicitudes_sedes
  for each row execute function public.fn_solicitud_sin_repetir();
