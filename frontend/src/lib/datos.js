import { supabase, consultar, traducirError, MARCA_RECUPERAR } from './supabase'

// ---------------------------------------------------------------------
// Capa de datos.
//
// Cada función de este archivo corresponde a un endpoint que antes vivía
// en tu carpeta routes/. La diferencia es que aquí no hay servidor en el
// medio: el navegador habla directo con PostgreSQL a través de PostgREST,
// y RLS decide qué filas devuelve.
//
// Todas devuelven { datos, error } para que las pantallas no tengan que
// repetir el manejo de errores.
// ---------------------------------------------------------------------

// =====================================================================
// AUTENTICACIÓN   (antes routes/auth.js)
// =====================================================================

export async function registrarse({ nombre, correo, password, telefono }) {
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password,
    // Estos datos los recoge el disparador fn_crear_perfil y con ellos
    // arma la fila en la tabla perfiles.
    options: { data: { nombre, telefono } },
  })
  return { datos: data, error: traducirError(error) }
}

export async function iniciarSesion(correo, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: correo,
    password,
  })
  return { datos: data, error: traducirError(error) }
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}

// A donde vuelve el enlace del correo. Esta URL debe estar en
// Authentication → URL Configuration → Redirect URLs de Supabase.
function urlRecuperacion() {
  return `${window.location.origin}${window.location.pathname}?${MARCA_RECUPERAR}=1`
}

export async function recuperarPorCorreo(correo) {
  const { error } = await supabase.auth.resetPasswordForEmail(correo.trim(), {
    redirectTo: urlRecuperacion(),
  })
  return { datos: null, error: traducirError(error) }
}

// Con el teléfono no se puede desde el navegador: la Edge Function busca
// el correo de la cuenta y le manda el mismo enlace (migración 0008).
export async function recuperarPorTelefono(telefono) {
  const { data, error } = await supabase.functions.invoke('recuperar-por-telefono', {
    body: { telefono, redirectTo: urlRecuperacion() },
  })
  if (error) {
    // Los 4xx traen el mensaje en el cuerpo de la respuesta.
    const cuerpo = await error.context?.json?.().catch(() => null)
    return { datos: null, error: cuerpo?.error ?? 'No pudimos enviar el enlace. Intenta más tarde.' }
  }
  return { datos: data, error: null }
}

// Solo funciona con la sesión que abre el enlace del correo (o con
// cualquier sesión activa).
export async function cambiarClave(nueva) {
  const { data, error } = await supabase.auth.updateUser({ password: nueva })
  return { datos: data, error: traducirError(error) }
}

export async function miPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datos: null, error: null }

  return consultar(
    supabase
      .from('perfiles')
      .select('id, nombre, telefono, rol, sede_id, sedes(id, nombre, slug, color_hex)')
      .eq('id', user.id)
      .single()
  )
}

// =====================================================================
// SEDES   (antes routes/sedes.js)
// =====================================================================

export function listarSedes() {
  return consultar(
    supabase
      .from('sedes')
      .select('id, nombre, slug, descripcion, direccion, telefono, color_hex, logo_url, hora_apertura, hora_cierre, canchas(id)')
      .eq('activa', true)
      .order('nombre')
  )
}

export function detalleSede(slug) {
  return consultar(
    supabase
      .from('sedes')
      .select(`
        id, nombre, slug, descripcion, direccion, telefono,
        color_hex, logo_url, hora_apertura, hora_cierre,
        canchas ( id, nombre, tipo, precio_hora, superficie,
                  techada, iluminacion, caracteristicas )
      `)
      .eq('slug', slug)
      .eq('activa', true)
      .eq('canchas.activa', true)
      .single()
  )
}

export function registrarEstablecimiento(datos) {
  return consultar(
    supabase.rpc('registrar_establecimiento', {
      p_nombre: datos.nombre,
      p_direccion: datos.direccion,
      p_telefono: datos.telefono,
      p_descripcion: datos.descripcion ?? null,
      p_color_hex: datos.colorHex ?? '#2563EB',
      p_hora_apertura: datos.horaApertura ?? '06:00',
      p_hora_cierre: datos.horaCierre ?? '23:00',
    })
  )
}

// =====================================================================
// CANCHAS   (antes routes/canchas.js)
// =====================================================================

export function listarCanchas(sedeId) {
  let q = supabase
    .from('canchas')
    .select('id, nombre, tipo, precio_hora, techada, iluminacion, caracteristicas, sede_id, sedes(nombre, slug, color_hex)')
    .eq('activa', true)
  if (sedeId) q = q.eq('sede_id', sedeId)
  return consultar(q.order('nombre'))
}

export function canchasDeSede(sedeId) {
  return consultar(
    supabase
      .from('canchas')
      .select('id, nombre')
      .eq('sede_id', sedeId)
      .eq('activa', true)
      .order('nombre')
  )
}

export function disponibilidad(canchaId, fecha) {
  return consultar(
    supabase.rpc('disponibilidad_cancha', {
      p_cancha_id: canchaId,
      p_fecha: fecha,
    })
  )
}

export function crearCancha(datos) {
  return consultar(
    supabase.from('canchas').insert({
      sede_id: datos.sedeId,
      nombre: datos.nombre,
      tipo: datos.tipo ?? 'Fútbol 6',
      precio_hora: datos.precioHora,
      techada: datos.techada ?? false,
      iluminacion: datos.iluminacion ?? true,
      caracteristicas: datos.caracteristicas ?? null,
    }).select().single()
  )
}

export function retirarCancha(id) {
  return consultar(
    supabase.from('canchas').update({ activa: false }).eq('id', id).select().single()
  )
}

// =====================================================================
// RESERVAS   (antes routes/reservas.js)
// =====================================================================

export function crearReserva(datos) {
  return consultar(
    supabase.rpc('crear_reserva', {
      p_cancha_id: datos.canchaId,
      p_fecha: datos.fecha,
      p_hora_inicio: datos.hora,
      p_duracion_horas: datos.duracionHoras ?? 1,
      p_cliente_nombre: datos.clienteNombre,
      p_cliente_tel: datos.clienteTel,
      p_cliente_correo: datos.clienteCorreo ?? null,
      p_metodo_pago: datos.metodoPago ?? null,
      p_notas: datos.notas ?? null,
    })
  )
}

// RLS decide qué devuelve: un jugador ve las suyas, un administrador las
// de su sede. No hay que filtrar nada desde aquí.
export function misReservas() {
  return consultar(
    supabase
      .from('reservas')
      .select('id, codigo, fecha, hora_inicio, hora_fin, cliente_nombre, precio_total, estado, canchas(nombre, sedes(nombre))')
      .order('fecha', { ascending: false })
      .limit(100)
  )
}

// Reservas del jugador en una sede, o en todas si sedeId es null. Se
// filtra por usuario_id aunque RLS ya lo haga: a un administrador RLS le
// devuelve todas las de su sede, y aquí solo queremos las que hizo él mismo.
export async function misReservasEnSede(sedeId = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datos: null, error: 'Inicia sesión para ver tus reservas.' }

  let q = supabase
    .from('reservas')
    .select('id, codigo, fecha, hora_inicio, hora_fin, precio_total, estado, canchas!inner ( nombre, tipo, sede_id, sedes ( nombre ) )')
    .eq('usuario_id', user.id)
  if (sedeId) q = q.eq('canchas.sede_id', sedeId)
  return consultar(
    q.order('fecha', { ascending: false }).order('hora_inicio', { ascending: false })
  )
}

export function buscarPorCodigo(codigo) {
  return consultar(
    supabase
      .from('reservas')
      .select('id, codigo, fecha, hora_inicio, hora_fin, cliente_nombre, precio_total, estado, canchas(nombre, sedes(nombre))')
      .eq('codigo', codigo.trim().toUpperCase())
      .single()
  )
}

export function cancelarReserva(id) {
  return consultar(supabase.rpc('cancelar_reserva', { p_reserva_id: id }))
}

export function cambiarEstadoReserva(id, estado, metodoPago) {
  return consultar(
    supabase.from('reservas')
      .update({ estado, ...(metodoPago ? { metodo_pago: metodoPago } : {}) })
      .eq('id', id).select().single()
  )
}

// =====================================================================
// PARTIDOS ABIERTOS   (antes routes/partidos.js)
// =====================================================================

export function listarPartidos(sedeId) {
  let q = supabase
    .from('partidos_abiertos')
    .select(`
      id, fecha, hora_inicio, modalidad, nivel, posicion_requerida,
      cupos_totales, cupos_ocupados, estado, creador_id,
      canchas!inner ( id, nombre, sede_id, sedes(nombre, slug) ),
      partido_jugadores ( usuario_id )
    `)
    .gte('fecha', new Date().toISOString().slice(0, 10))
    .neq('estado', 'cancelado')
  if (sedeId) q = q.eq('canchas.sede_id', sedeId)
  return consultar(q.order('fecha').limit(50))
}

// Partidos abiertos o completos desde una fecha, con quiénes están
// anotados. Los completos vienen para que quien ya está adentro pueda
// salirse; la pantalla oculta los completos en los que no estás.
export function partidosBuscandoJugadores(sedeId, desde) {
  let q = supabase
    .from('partidos_abiertos')
    .select(`
      id, fecha, hora_inicio, modalidad, nivel, posicion_requerida,
      cupos_totales, cupos_ocupados, cupos_disponibles, creador_id,
      canchas!inner ( nombre, sede_id, sedes ( nombre, slug ) ),
      partido_jugadores ( usuario_id )
    `)
    .in('estado', ['abierto', 'completo'])
    .gte('fecha', desde)
  if (sedeId) q = q.eq('canchas.sede_id', sedeId)
  return consultar(q.order('fecha').order('hora_inicio'))
}

// creador_id sale de la sesión, nunca del formulario. cupos_ocupados lo
// mantiene el trigger y cupos_disponibles es generada: no se escriben.
export async function crearPartido(datos) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datos: null, error: 'Inicia sesión para publicar un partido.' }

  return consultar(
    supabase.from('partidos_abiertos').insert({
      creador_id: user.id,
      cancha_id: datos.canchaId,
      fecha: datos.fecha,
      hora_inicio: datos.hora,
      modalidad: datos.modalidad ?? 'Fútbol 6',
      nivel: datos.nivel ?? 'todos',
      posicion_requerida: datos.posicionRequerida || null,
      cupos_totales: datos.cuposTotales,
    }).select().single()
  )
}

// Unirse es insertar una fila. El CHECK de cupos y el UNIQUE hacen el
// resto: no hay que leer el contador ni actualizarlo a mano.
export async function unirseAPartido(partidoId, posicion = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datos: null, error: 'Inicia sesión para unirte.' }

  return consultar(
    supabase.from('partido_jugadores')
      .insert({ partido_id: partidoId, usuario_id: user.id, posicion })
      .select().single()
  )
}

export async function salirDePartido(partidoId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datos: null, error: 'Inicia sesión para salirte.' }
  return consultar(
    supabase.from('partido_jugadores')
      .delete().eq('partido_id', partidoId).eq('usuario_id', user.id)
  )
}

// =====================================================================
// TORNEOS   (antes routes/torneos.js)
// =====================================================================

export function listarTorneos(sedeId) {
  let q = supabase
    .from('torneos')
    .select('id, nombre, descripcion, modalidad, cupos_totales, cupos_inscritos, fecha_inicio, cierre_inscripcion, premio, estado, sedes(nombre, slug)')
  if (sedeId) q = q.eq('sede_id', sedeId)
  return consultar(q.order('creado_at', { ascending: false }))
}

export function tablaTorneo(torneoId) {
  return consultar(
    supabase.from('v_tabla_torneo')
      .select('*')
      .eq('torneo_id', torneoId)
      .order('posicion')
  )
}

export function crearTorneo(datos) {
  return consultar(
    supabase.from('torneos').insert({
      sede_id: datos.sedeId,
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      modalidad: datos.modalidad ?? 'Fútbol 6',
      cupos_totales: datos.cuposTotales,
      fecha_inicio: datos.fechaInicio ?? null,
      cierre_inscripcion: datos.cierreInscripcion ?? null,
      premio: datos.premio ?? null,
    }).select().single()
  )
}

export async function inscribirEquipo(torneoId, nombreEquipo) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { datos: null, error: 'Inicia sesión para inscribir tu equipo.' }

  return consultar(
    supabase.from('inscripciones_torneos')
      .insert({ torneo_id: torneoId, capitan_id: user.id, nombre_equipo: nombreEquipo })
      .select().single()
  )
}

export function registrarResultado({ local, visitante, golesLocal, golesVisitante }) {
  return consultar(
    supabase.rpc('registrar_resultado', {
      p_equipo_local: local,
      p_equipo_visitante: visitante,
      p_goles_local: golesLocal,
      p_goles_visitante: golesVisitante,
    })
  )
}

// =====================================================================
// PANEL DEL NEGOCIO   (antes routes/dashboard.js)
// =====================================================================

export function metricas(desde, hasta) {
  return consultar(
    supabase.rpc('metricas_sede', { p_desde: desde, p_hasta: hasta })
  )
}

export function ocupacionPorCancha(desde, hasta) {
  return consultar(
    supabase.rpc('ocupacion_por_cancha', { p_desde: desde, p_hasta: hasta })
  )
}

export function zonasMuertas(dias = 60) {
  return consultar(supabase.rpc('zonas_muertas', { p_dias: dias }))
}

// =====================================================================
// ADMINISTRADOR GENERAL   (migración 0007, solo rol superadmin)
// =====================================================================

// Si RLS no deja borrar, Supabase no da error: borra cero filas. Por eso
// se pide la fila borrada de vuelta y se revisa que haya llegado.
async function eliminarFila(tabla, id) {
  const { datos, error } = await consultar(supabase.from(tabla).delete().eq('id', id).select('id'))
  if (error) return { datos: null, error }
  if (!datos?.length) return { datos: null, error: 'No se pudo eliminar: no existe o no tienes permiso.' }
  return { datos: datos[0], error: null }
}

export function eliminarTorneo(id) {
  return eliminarFila('torneos', id)
}

export function eliminarPartido(id) {
  return eliminarFila('partidos_abiertos', id)
}

// Todo el contenido para el panel: partidos, torneos y canchas con su
// sede. Son pocas filas, así que se agrupan en el navegador.
export async function contenidoAdmin() {
  const [partidos, torneos, canchas] = await Promise.all([
    consultar(
      supabase.from('partidos_abiertos')
        .select('id, fecha, hora_inicio, modalidad, estado, cupos_totales, cupos_ocupados, canchas ( nombre, sede_id, sedes ( nombre ) )')
        .order('fecha', { ascending: false })
    ),
    consultar(
      supabase.from('torneos')
        .select('id, nombre, modalidad, estado, cupos_totales, cupos_inscritos, fecha_inicio, sede_id, sedes ( nombre )')
        .order('creado_at', { ascending: false })
    ),
    consultar(supabase.from('canchas').select('id, nombre, activa, sede_id')),
  ])

  const error = partidos.error ?? torneos.error ?? canchas.error
  if (error) return { datos: null, error }

  return {
    datos: { partidos: partidos.datos ?? [], torneos: torneos.datos ?? [], canchas: canchas.datos ?? [] },
    error: null,
  }
}

export function adminListarUsuarios() {
  return consultar(supabase.rpc('admin_listar_usuarios'))
}

export function adminCrearUsuario({ correo, clave, nombre, telefono = null, rol = 'jugador', sedeId = null }) {
  return consultar(
    supabase.rpc('admin_crear_usuario', {
      p_correo: correo,
      p_clave: clave,
      p_nombre: nombre,
      p_telefono: telefono,
      p_rol: rol,
      p_sede_id: sedeId,
    })
  )
}

export function adminCambiarRol(usuarioId, rol, sedeId = null) {
  return consultar(
    supabase.rpc('admin_cambiar_rol', { p_usuario: usuarioId, p_rol: rol, p_sede_id: sedeId })
  )
}

export function adminEliminarUsuario(usuarioId) {
  return consultar(supabase.rpc('admin_eliminar_usuario', { p_usuario: usuarioId }))
}

export function metricasGlobales(desde, hasta) {
  return consultar(
    supabase.rpc('metricas_globales', { p_desde: desde, p_hasta: hasta })
  )
}

// Las del admin de sede (migración 0009). La sede la pone el servidor.
export function metricasMiSede(desde, hasta) {
  return consultar(
    supabase.rpc('metricas_mi_sede', { p_desde: desde, p_hasta: hasta })
  )
}
