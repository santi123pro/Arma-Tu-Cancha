import { useEffect, useState } from 'react'
import { hoyLocal } from '../lib/formato'
import { canchasDeSede, crearPartido, partidosBuscandoJugadores, salirDePartido, unirseAPartido } from '../lib/datos'
import { useSesion } from '../lib/useSesion'
import { useToast } from '../componentes/Toast'
import Cargando from '../componentes/Cargando'

const MODALIDADES = ['Fútbol 5', 'Fútbol 6', 'Fútbol 7', 'Fútbol 8', 'Fútbol 11']

// El value va en minúscula exacta: es lo que acepta el CHECK de nivel.
const NIVELES = [
  { valor: 'todos', etiqueta: 'Todos los niveles' },
  { valor: 'principiante', etiqueta: 'Principiante' },
  { valor: 'intermedio', etiqueta: 'Intermedio' },
  { valor: 'avanzado', etiqueta: 'Avanzado' },
]

const POSICIONES = ['Arquero', 'Defensa', 'Mediocampista', 'Delantero']

const FORM_VACIO = {
  canchaId: '',
  fecha: '',
  hora: '',
  modalidad: 'Fútbol 6',
  nivel: 'todos',
  posicion: '',
  cupos: '',
}


// '2026-10-05' + '19:00:00' → 'domingo 5 de octubre · 7:00 p. m.'
function fechaLegible(fecha, hora) {
  const [a, m, d] = fecha.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  const momento = new Date(a, m - 1, d, h, min)
  const dia = momento.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const reloj = momento.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  return `${dia} · ${reloj}`
}

function etiquetaNivel(valor) {
  return NIVELES.find((n) => n.valor === valor)?.etiqueta ?? valor
}

export default function Partidos({ sedeId, sedeNombre }) {
  const { autenticado, usuario } = useSesion()
  const toast = useToast()
  const hoy = hoyLocal()

  const [canchas, setCanchas] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [publicando, setPublicando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)

  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorLista, setErrorLista] = useState(null)
  const [recarga, setRecarga] = useState(0)
  // Partido en el que se está uniendo o saliendo, para bloquear su botón.
  const [ocupado, setOcupado] = useState(null)

  // Canchas del desplegable: se recargan al cambiar de sede y se limpia
  // la que estuviera elegida, porque ya no pertenece a esta sede.
  useEffect(() => {
    let vigente = true
    setForm((f) => ({ ...f, canchaId: '' }))
    canchasDeSede(sedeId).then(({ datos }) => {
      if (vigente) setCanchas(datos ?? [])
    })
    return () => { vigente = false }
  }, [sedeId])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setErrorLista(null)
    partidosBuscandoJugadores(sedeId, hoy).then(({ datos, error }) => {
      if (!vigente) return
      if (error) setErrorLista(error)
      else setPartidos(datos ?? [])
      setCargando(false)
    })
    return () => { vigente = false }
  }, [sedeId, hoy, recarga])

  function cambiar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  }

  async function publicar(e) {
    e.preventDefault()
    if (publicando) return
    setErrorForm(null)

    const cupos = Number(form.cupos)
    if (!form.canchaId) return setErrorForm('Selecciona la cancha.')
    if (!form.fecha || form.fecha < hoy) return setErrorForm('Elige una fecha de hoy en adelante.')
    if (!form.hora) return setErrorForm('Indica la hora de inicio.')
    if (!Number.isInteger(cupos) || cupos < 1 || cupos > 22) {
      return setErrorForm('Los cupos deben estar entre 1 y 22.')
    }

    setPublicando(true)
    const { error } = await crearPartido({
      canchaId: Number(form.canchaId),
      fecha: form.fecha,
      hora: form.hora,
      modalidad: form.modalidad,
      nivel: form.nivel,
      posicionRequerida: form.posicion || null,
      cuposTotales: cupos,
    })
    setPublicando(false)

    if (error) {
      setErrorForm(error)
      toast(error, 'error')
      return
    }

    toast('¡Partido publicado! Ya aparece en la lista.', 'success')
    setForm(FORM_VACIO)
    setRecarga((n) => n + 1)
  }

  async function unirseAlPartido(p) {
    if (ocupado) return
    setOcupado(p.id)
    const { error } = await unirseAPartido(p.id, p.posicion_requerida)
    setOcupado(null)
    if (error) return toast(error, 'error')
    toast('¡Listo! Quedaste anotado en el partido.', 'success')
    setRecarga((n) => n + 1)
  }

  async function salirDelPartido(p) {
    if (ocupado) return
    setOcupado(p.id)
    const { error } = await salirDePartido(p.id)
    setOcupado(null)
    if (error) return toast(error, 'error')
    toast('Te saliste del partido.')
    setRecarga((n) => n + 1)
  }

  const estoyEn = (p) => p.partido_jugadores?.some((j) => j.usuario_id === usuario?.id)
  // Los completos solo se muestran a quien ya está anotado.
  const visibles = partidos.filter((p) => p.cupos_disponibles > 0 || estoyEn(p))

  return (
    <section className="seccion-partidos">
      {/* ── Bloque A: publicar ── */}
      <div className="partidos-bloque">
        <div className="landing-header-flex partidos-encabezado">
          <div>
            <span className="sub-tag">Publicar Partido Abierto</span>
            <h2 className="landing-title">Arma tu Partido</h2>
          </div>
          {sedeNombre && (
            <p className="landing-desc-side">
              ¿Te faltan jugadores? Publica tu partido en {sedeNombre} y que se anoten los que quieran.
            </p>
          )}
        </div>

        {!autenticado ? (
          <p className="partidos-aviso">Necesitas iniciar sesión para publicar un partido.</p>
        ) : (
          <form className="form-partido" onSubmit={publicar} noValidate>
            <label className="form-partido-completo">
              Cancha
              <select className="input-moderno" value={form.canchaId} onChange={cambiar('canchaId')}>
                <option value="">Selecciona la cancha</option>
                {canchas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </label>

            <label>
              Fecha del partido
              <input type="date" className="input-moderno" min={hoy} value={form.fecha} onChange={cambiar('fecha')} />
            </label>

            <label>
              Hora de inicio
              <input type="time" className="input-moderno" value={form.hora} onChange={cambiar('hora')} />
            </label>

            <label>
              Modalidad
              <select className="input-moderno" value={form.modalidad} onChange={cambiar('modalidad')}>
                {MODALIDADES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label>
              Nivel requerido
              <select className="input-moderno" value={form.nivel} onChange={cambiar('nivel')}>
                {NIVELES.map((n) => <option key={n.valor} value={n.valor}>{n.etiqueta}</option>)}
              </select>
            </label>

            <label>
              Buscando
              <select className="input-moderno" value={form.posicion} onChange={cambiar('posicion')}>
                <option value="">Cualquier posición</option>
                {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <label>
              Cupos totales
              <input
                type="number" className="input-moderno" min={1} max={22}
                value={form.cupos} onChange={cambiar('cupos')}
              />
            </label>

            {errorForm && (
              <p className="form-partido-completo partidos-error" role="alert">{errorForm}</p>
            )}

            <button type="submit" className="btn-cta-primary form-partido-completo" disabled={publicando}>
              {publicando ? 'Publicando...' : 'Publicar Partido Ahora'}
            </button>
          </form>
        )}
      </div>

      {/* ── Bloque B: lista ── */}
      <div className="partidos-bloque">
        <h2 className="landing-title">Partidos buscando jugadores</h2>

        {cargando ? (
          <Cargando texto="Cargando partidos" />
        ) : errorLista ? (
          <div className="partidos-aviso">
            <p className="partidos-error">{errorLista}</p>
            <button type="button" className="btn-cta-primary" onClick={() => setRecarga((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : visibles.length === 0 ? (
          <p className="partidos-aviso">Ahora mismo no hay partidos buscando jugadores.</p>
        ) : (
          <div className="grid-canchas grid-partidos">
            {visibles.map((p) => (
              <article key={p.id} className="tarjeta-cancha">
                <h3>{p.canchas?.nombre}</h3>
                <p className="partido-fecha">{fechaLegible(p.fecha, p.hora_inicio)}</p>
                <p><strong>Modalidad:</strong> {p.modalidad}</p>
                <p><strong>Nivel:</strong> {etiquetaNivel(p.nivel)}</p>
                <p><strong>Buscan:</strong> {p.posicion_requerida ?? 'Cualquier posición'}</p>
                <div className="partido-cupos">
                  <p><span>{p.cupos_disponibles}</span> de {p.cupos_totales} cupos libres</p>
                  <div className="partido-barra">
                    <i style={{ width: `${(1 - p.cupos_disponibles / p.cupos_totales) * 100}%` }} />
                  </div>
                </div>
                {!autenticado ? (
                  <p className="torneo-nota">Inicia sesión para unirte.</p>
                ) : estoyEn(p) ? (
                  <>
                    <p className="torneo-nota">
                      ✅ {p.creador_id === usuario?.id ? 'Publicaste este partido y estás anotado.' : 'Ya estás anotado.'}
                    </p>
                    <button
                      type="button" className="btn-torneo-cancelar"
                      onClick={() => salirDelPartido(p)} disabled={ocupado === p.id}
                    >
                      {ocupado === p.id ? 'Saliendo…' : 'Salirme del partido'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button" className="btn-cta-primary"
                    onClick={() => unirseAlPartido(p)} disabled={ocupado === p.id}
                  >
                    {ocupado === p.id ? 'Uniéndote…' : 'Unirse al partido'}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
