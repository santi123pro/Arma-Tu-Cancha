-- ═══════════════════════════════════════════════════════════════
-- 0004_cupos_disponibles.sql
--
-- Columna calculada para poder listar los partidos que todavia
-- buscan jugadores.
--
-- Por que se necesita: PostgREST no compara dos columnas entre si,
-- asi que .lt('cupos_ocupados','cupos_totales') no funciona — toma
-- el segundo argumento como el texto "cupos_totales", no como la
-- columna. Con esta columna el filtro queda .gt('cupos_disponibles', 0).
--
-- "generated always as ... stored" significa que PostgreSQL la
-- mantiene solo en cada insert y update. No se puede escribir por
-- error desde el frontend, y nunca se desincroniza de cupos_ocupados,
-- que ya lo mantiene el trigger fn_sync_cupos_partido.
-- ═══════════════════════════════════════════════════════════════

alter table public.partidos_abiertos
  add column if not exists cupos_disponibles integer
  generated always as (cupos_totales - cupos_ocupados) stored;

-- Indice para el listado de "partidos que buscan jugadores".
-- Sin el, cada consulta recorre toda la tabla.
create index if not exists partidos_con_cupo
  on public.partidos_abiertos (fecha, hora_inicio)
  where estado = 'abierto' and cupos_disponibles > 0;
