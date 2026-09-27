import { useState } from 'react'
import { iniciarSesion, registrarse } from '../lib/datos'
import { useToast } from '../componentes/Toast'

export default function Auth() {
  const toast = useToast()

  const [login, setLogin] = useState({ correo: '', password: '' })
  const [reg, setReg] = useState({ nombre: '', correo: '', password: '' })
  const [enviando, setEnviando] = useState(false)

  async function entrar(e) {
    e.preventDefault()
    if (!login.correo || !login.password) {
      return toast('Ingresa correo y contraseña.', 'warn')
    }

    setEnviando(true)
    const { error } = await iniciarSesion(login.correo.trim(), login.password)
    setEnviando(false)

    if (error) return toast(error, 'error')
    // No hay que hacer nada más: useSesion detecta el cambio y App.jsx
    // cambia de pantalla solo.
  }

  async function crearCuenta(e) {
    e.preventDefault()
    if (!reg.nombre || !reg.correo || !reg.password) {
      return toast('Completa todos los campos para registrarte.', 'warn')
    }
    if (reg.password.length < 6) {
      return toast('La contraseña debe tener al menos 6 caracteres.', 'warn')
    }

    setEnviando(true)
    const { error } = await registrarse({
      nombre: reg.nombre.trim(),
      correo: reg.correo.trim(),
      password: reg.password,
    })
    setEnviando(false)

    if (error) return toast(error, 'error')

    toast('Cuenta creada. Ya puedes entrar.')
    setLogin({ correo: reg.correo.trim(), password: '' })
    setReg({ nombre: '', correo: '', password: '' })
  }

  return (
    <section
      id="seccion-auth-principal"
      className="auth-landing-container"
      style={{ display: 'flex', justifyContent: 'center', gap: 30, flexWrap: 'wrap', padding: '60px 20px' }}
    >
      <div className="auth-card-landing" style={{ flex: 1, minWidth: 300, maxWidth: 380 }}>
        <h2>🔑 Iniciar Sesión</h2>
        <p>Accede con tus credenciales registradas.</p>
        <form onSubmit={entrar}>
          <input
            type="email" placeholder="Correo electrónico" className="input-moderno"
            value={login.correo}
            onChange={(e) => setLogin({ ...login, correo: e.target.value })}
          />
          <input
            type="password" placeholder="Contraseña" className="input-moderno"
            value={login.password}
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
          />
          <button
            type="submit" className="btn-cta-primary" disabled={enviando}
            style={{ marginTop: 15, width: '100%' }}
          >
            {enviando ? 'Entrando…' : 'Entrar al Sistema'}
          </button>
        </form>
      </div>

      <div className="auth-card-landing" style={{ flex: 1, minWidth: 300, maxWidth: 380 }}>
        <h2>📝 Crear Cuenta Nueva</h2>
        <p>Regístrate para armar partidos y torneos.</p>
        <form onSubmit={crearCuenta}>
          <input
            type="text" placeholder="Nombre completo" className="input-moderno"
            value={reg.nombre}
            onChange={(e) => setReg({ ...reg, nombre: e.target.value })}
          />
          <input
            type="email" placeholder="Correo electrónico" className="input-moderno"
            value={reg.correo}
            onChange={(e) => setReg({ ...reg, correo: e.target.value })}
          />
          <input
            type="password" placeholder="Contraseña segura" className="input-moderno"
            value={reg.password}
            onChange={(e) => setReg({ ...reg, password: e.target.value })}
          />
          <button
            type="submit" className="btn-cta-secondary" disabled={enviando}
            style={{ marginTop: 15, width: '100%', background: '#2980b9', border: 'none', color: 'white' }}
          >
            {enviando ? 'Creando…' : 'Registrarse Ahora'}
          </button>
        </form>
      </div>
    </section>
  )
}