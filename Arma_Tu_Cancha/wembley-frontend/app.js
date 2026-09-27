// ═══════════════════════════════════════════════════════════
//  Arma Tu Cancha — app.js  (reescrito por completo)
//  Mantiene: mismas variables de BD, mismos endpoints,
//  mismo stack. Elimina bugs, mejora UX, consolida lógica.
// ═══════════════════════════════════════════════════════════

const API = 'http://localhost:3000/api';

// ── Estado global ────────────────────────────────────────────
let sedeActual   = '';
let rolUsuario   = 'jugador';
let canchaReservaId = null;
let dashboardData = { reservas:[], torneos:[], partidos:[], usuarios:[] };

// ── Helpers de token ─────────────────────────────────────────
function getToken()  { return localStorage.getItem('token'); }
function getCorreo() { return localStorage.getItem('correo') || ''; }

function decodeToken(t) {
  try { return JSON.parse(atob(t.split('.')[1])); }
  catch { return null; }
}

function authHeader() {
  return { 'Content-Type':'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function esAdmin() { return rolUsuario === 'admin'; }
function esAdminOAyudante() { return rolUsuario === 'admin' || rolUsuario === 'ayudante'; }

// ── API helper (evita duplicar try/catch en todo el código) ──
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, tipo = 'success') {
  const ctn = document.getElementById('toast-container');
  if (!ctn) return;
  const el = document.createElement('div');
  const bg = tipo === 'success' ? '#16a34a' : tipo === 'warn' ? '#d97706' : '#dc2626';
  el.style.cssText = `
    background:${bg};color:#fff;padding:13px 22px;border-radius:10px;
    font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);
    opacity:0;transform:translateY(-16px);transition:all .25s ease;
    pointer-events:auto;max-width:380px;line-height:1.4;
  `;
  el.textContent = msg;
  ctn.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-16px)';
    setTimeout(() => el.remove(), 280);
  }, 3400);
}

// ── Mostrar / Ocultar elementos ───────────────────────────────
function show(id, display = 'block') {
  const el = document.getElementById(id);
  if (el) el.style.setProperty('display', display, 'important');
}
function hide(id) {
  const el = document.getElementById(id);
  if (el) el.style.setProperty('display', 'none', 'important');
}

// ═══════════════════════════════════════════════════════════
//  ARRANQUE
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  sedeActual = localStorage.getItem('sedeActual') || '';

  // Listeners permanentes
  document.getElementById('btn-crear-partido')?.addEventListener('click', crearPartido);
  document.getElementById('btn-crear-torneo')?.addEventListener('click', crearTorneo);
  document.getElementById('btn-inscribir-torneo')?.addEventListener('click', inscribirEquipo);

  if (getToken()) {
    iniciarUI();
  } else {
    show('vista-portada');
    show('auth-forms', 'block');
    hide('vista-marketplace');
    hide('vista-presentacion-sede');
    hide('seccion-canchas');
    hide('user-info');
  }
});

// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
async function registrarUsuarioNuevo() {
  const nombre   = document.getElementById('reg-nombre')?.value.trim();
  const correo   = document.getElementById('reg-correo')?.value.trim();
  const password = document.getElementById('reg-clave')?.value;

  if (!nombre || !correo || !password)
    return toast('Completa todos los campos para registrarte.', 'error');
  if (password.length < 6)
    return toast('La contraseña debe tener al menos 6 caracteres.', 'warn');

  const { ok, data } = await api('/auth/registro', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, correo, password })
  });

  if (!ok) return toast(data.error || 'Error al registrar.', 'error');

  toast('Cuenta creada. Ya puedes iniciar sesión.');
  ['reg-nombre','reg-correo','reg-clave'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const elCorreo = document.getElementById('correo');
  if (elCorreo) elCorreo.value = correo;
}

async function iniciarSesion() {
  const correo   = document.getElementById('correo')?.value.trim();
  const password = document.getElementById('password')?.value;

  if (!correo || !password)
    return toast('Ingresa correo y contraseña.', 'warn');

  const { ok, data } = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correo, password })
  });

  if (!ok) return toast(data.error || 'Credenciales incorrectas.', 'error');

  localStorage.setItem('token', data.token);
  localStorage.setItem('correo', correo);
  toast('Bienvenido de vuelta.');
  iniciarUI();
}

function cerrarSesion() {
  ['token','correo','rol','sedeActual'].forEach(k => localStorage.removeItem(k));
  sedeActual = '';
  rolUsuario = 'jugador';

  show('vista-portada');
  show('auth-forms', 'block');
  hide('user-info');
  hide('seccion-canchas');
  hide('vista-marketplace');
  hide('vista-presentacion-sede');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast('Sesión cerrada.');
}

// ═══════════════════════════════════════════════════════════
//  UI PRINCIPAL TRAS LOGIN
// ═══════════════════════════════════════════════════════════
function iniciarUI() {
  const token = getToken();
  const payload = decodeToken(token);

  if (!payload) {
    // Token inválido o expirado
    cerrarSesion();
    return toast('La sesión expiró. Inicia sesión de nuevo.', 'warn');
  }

  rolUsuario = payload.rol || 'jugador';
  localStorage.setItem('rol', rolUsuario);

  // Header
  const saludo = document.getElementById('saludo-usuario');
  if (saludo) {
    const nombre = getCorreo().split('@')[0];
    const badge  = rolUsuario === 'admin'    ? '#22c55e' :
                   rolUsuario === 'ayudante' ? '#f59e0b' : '#38bdf8';
    saludo.innerHTML =
      `👤 <strong>${nombre}</strong>
       <span style="font-size:11px;background:${badge};color:#0f172a;
         padding:2px 7px;border-radius:4px;font-weight:700;
         text-transform:uppercase;margin-left:6px;">${rolUsuario}</span> &nbsp;|&nbsp;`;
  }

  // Pestaña dashboard
  const btnDash = document.getElementById('btn-tab-dashboard');
  if (btnDash) {
    btnDash.style.display = esAdminOAyudante() ? 'inline-block' : 'none';
  }

  hide('vista-portada');
  hide('auth-forms');
  show('user-info', 'block');
  hide('seccion-canchas');
  hide('vista-presentacion-sede');
  show('vista-marketplace', 'block');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (esAdminOAyudante()) cargarDashboardAdmin();
}

// ═══════════════════════════════════════════════════════════
//  MARKETPLACE — SEDES
// ═══════════════════════════════════════════════════════════
const SEDES = {
  'Wembley': {
    icono: '🏟️',
    color: 'linear-gradient(135deg,#1e3a8a,#3b82f6)',
    subtitulo: 'Norte de Cali · Sede principal',
    descripcion: 'Wembley Norte cuenta con canchas de grama sintética de última generación. El lugar ideal para jugar fútbol 6 a nivel semiprofesional con tus amigos, con parqueadero, camerinos VIP y zona de comidas.',
    canchas: 3, precio: '$80.000', horarios: 4,
    features: [
      { i:'📍', l:'Parqueadero gratis', v:'Siempre disponible' },
      { i:'🚿', l:'Camerinos VIP',     v:'Con duchas' },
      { i:'🍔', l:'Zona de comidas',   v:'Abierta siempre' },
      { i:'🕒', l:'Horario',           v:'6 AM – 12 AM' },
    ]
  },
  'La Bombonera': {
    icono: '🔥',
    color: 'linear-gradient(135deg,#b45309,#eab308)',
    subtitulo: 'Sur de Cali · La más vibrante',
    descripcion: '¡Entraste a la caldera! La Bombonera es para los que juegan al límite. Canchas sintéticas de fútbol 6 con gradería cercana, bebidas frías y el ambiente más intenso de la ciudad.',
    canchas: 2, precio: '$70.000', horarios: 2,
    features: [
      { i:'🔥', l:'Gradería cercana', v:'Ambiente total' },
      { i:'🚿', l:'Duchas',          v:'Disponibles' },
      { i:'🍺', l:'Bebidas frías',   v:'En el lugar' },
      { i:'🕒', l:'Horario',         v:'8 AM – 11 PM' },
    ]
  },
  'Bernabéu': {
    icono: '👑',
    color: 'linear-gradient(135deg,#334155,#94a3b8)',
    subtitulo: 'Oeste de Cali · La sede premium',
    descripcion: 'La Casa Blanca del fútbol amateur. Iluminación LED profesional, grama sintética premium de fútbol 6, valet parking y marcador digital. Para los que exigen lo mejor.',
    canchas: 2, precio: '$75.000', horarios: 1,
    features: [
      { i:'👑', l:'Instalaciones Premium', v:'Primera categoría' },
      { i:'💡', l:'Iluminación LED',       v:'Profesional' },
      { i:'🚗', l:'Valet Parking',         v:'Incluido' },
      { i:'🏆', l:'Marcador Digital',      v:'En tiempo real' },
    ]
  }
};

function abrirSede(nombre) {
  const cfg = SEDES[nombre];
  if (!cfg) return;

  sedeActual = nombre;
  localStorage.setItem('sedeActual', nombre);

  hide('vista-marketplace');

  const vp = document.getElementById('vista-presentacion-sede');
  if (!vp) return;

  vp.innerHTML = `
  <style>
    .lobby-wrap{max-width:960px;margin:0 auto;padding:28px 20px}
    .lobby-back{background:none;border:none;color:#64748b;cursor:pointer;font-size:13px;
      font-weight:600;margin-bottom:20px;display:flex;align-items:center;gap:6px;padding:0}
    .lobby-back:hover{color:#0f172a}
    .lobby-card{background:#fff;border-radius:20px;overflow:hidden;
      border:1px solid #e2e8f0;box-shadow:0 8px 32px rgba(0,0,0,.07)}
    .lobby-banner{padding:56px 20px;display:flex;flex-direction:column;
      align-items:center;text-align:center;position:relative}
    .lb-status{position:absolute;top:14px;right:18px;background:rgba(255,255,255,.18);
      color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;
      border:1px solid rgba(255,255,255,.3);letter-spacing:.04em}
    .lb-icon{font-size:52px;margin-bottom:10px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.2))}
    .lobby-banner h1{font-size:42px;font-weight:800;color:#fff;margin:0 0 6px;
      text-shadow:0 3px 12px rgba(0,0,0,.25)}
    .lobby-banner p{color:rgba(255,255,255,.8);font-size:14px;margin:0}
    .lobby-body{padding:32px 36px}
    .lobby-desc{font-size:15px;color:#475569;line-height:1.7;margin:0 0 24px;
      text-align:center;max-width:660px;margin-left:auto;margin-right:auto}
    .lobby-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;
      margin-bottom:24px;background:#f8fafc;border-radius:14px;padding:18px;
      border:1px solid #e2e8f0}
    .lobby-stat{text-align:center}
    .lobby-stat .sn{font-size:26px;font-weight:700;color:#0f172a}
    .lobby-stat .sl{font-size:11px;color:#64748b;margin-top:3px}
    .lobby-feats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
      gap:10px;margin-bottom:28px}
    .lobby-feat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;
      padding:14px;text-align:center}
    .lf-icon{font-size:24px;margin-bottom:6px}
    .lf-label{font-size:12px;font-weight:600;color:#334155}
    .lf-val{font-size:11px;color:#64748b;margin-top:2px}
    .lobby-cta{border-top:2px dashed #e2e8f0;padding-top:24px;text-align:center}
    .lobby-cta h3{font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px}
    .lobby-cta p{font-size:13px;color:#64748b;margin:0 0 18px}
    .btn-juega{background:#22c55e;color:#fff;padding:14px 48px;font-size:17px;
      font-weight:800;border:none;border-radius:12px;cursor:pointer;
      box-shadow:0 6px 24px rgba(34,197,94,.35);transition:transform .15s,box-shadow .15s}
    .btn-juega:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(34,197,94,.45)}
  </style>

  <div class="lobby-wrap">
    <button class="lobby-back" onclick="volverAlMarketplace()">← Volver a los complejos</button>
    <div class="lobby-card">
      <div class="lobby-banner" style="background:${cfg.color}">
        <span class="lb-status">🟢 ABIERTO</span>
        <div class="lf-icon" style="font-size:52px;margin-bottom:10px">${cfg.icono}</div>
        <h1>${nombre}</h1>
        <p>${cfg.subtitulo}</p>
      </div>
      <div class="lobby-body">
        <p class="lobby-desc">${cfg.descripcion}</p>
        <div class="lobby-stats">
          <div class="lobby-stat"><div class="sn">${cfg.canchas}</div><div class="sl">Canchas disponibles</div></div>
          <div class="lobby-stat"><div class="sn">${cfg.precio}</div><div class="sl">Precio / hora</div></div>
          <div class="lobby-stat"><div class="sn">${cfg.horarios}</div><div class="sl">Horarios libres hoy</div></div>
        </div>
        <div class="lobby-feats">
          ${cfg.features.map(f=>`
            <div class="lobby-feat">
              <div class="lf-icon">${f.i}</div>
              <div class="lf-label">${f.l}</div>
              <div class="lf-val">${f.v}</div>
            </div>
          `).join('')}
        </div>
        <div class="lobby-cta">
          <h3>¿Todo listo para pisar la cancha?</h3>
          <p>Reserva tu horario de fútbol 6 en segundos. Sin llamadas, sin WhatsApp.</p>
          <button class="btn-juega" onclick="activarJuegaYa()">⚡ JUEGA YA</button>
        </div>
      </div>
    </div>
  </div>`;

  vp.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverAlMarketplace() {
  hide('vista-presentacion-sede');
  hide('seccion-canchas');
  show('vista-marketplace', 'block');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function activarJuegaYa() {
  hide('vista-presentacion-sede');
  show('seccion-canchas', 'block');
  cambiarTab('reservas', null);
  obtenerCanchas();
  obtenerPartidos();
  obtenerTorneos();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════
function cambiarTab(tabName, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  const tab = document.getElementById('tab-' + tabName);
  if (tab) tab.style.display = 'block';
  if (btn) btn.classList.add('active');
  else {
    // Activa el tab correcto por nombre
    document.querySelectorAll('.tab-btn').forEach(el => {
      if (el.getAttribute('onclick')?.includes(`'${tabName}'`)) el.classList.add('active');
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  CANCHAS Y RESERVAS
// ═══════════════════════════════════════════════════════════
async function obtenerCanchas() {
  const contenedor = document.getElementById('contenedor-canchas');
  if (!contenedor) return;
  contenedor.innerHTML = `<p style="text-align:center;color:#64748b;padding:20px">Cargando canchas…</p>`;

  try {
    const [rC, rR] = await Promise.all([
      api(`/canchas?sede=${encodeURIComponent(sedeActual)}`),
      api(`/reservas?sede=${encodeURIComponent(sedeActual)}`)
    ]);
    const canchas  = rC.ok  ? rC.data  : [];
    const reservas = rR.ok  ? rR.data  : [];

    if (!canchas.length) {
      contenedor.innerHTML = `<p style="text-align:center;color:#64748b;padding:30px">
        No hay canchas configuradas en ${sedeActual || 'esta sede'} todavía.</p>`;
      return;
    }

    const hoy      = new Date().toISOString().split('T')[0];
    const maxDate  = new Date();
    maxDate.setDate(maxDate.getDate() + 15);
    const maxFecha = maxDate.toISOString().split('T')[0];

    const franjas  = ['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM',
                      '5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM'];

    // Header de sede
    let html = `
      <div style="grid-column:1/-1;display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap">
        <div style="background:#0f172a;color:#fff;padding:14px 20px;border-radius:12px;
          flex:1;min-width:180px;border-left:4px solid #22c55e">
          <span style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase">Complejo activo</span>
          <h3 style="margin:5px 0 0;font-size:18px">🏟️ ${sedeActual || 'Wembley'}</h3>
        </div>
        <div style="background:#0f172a;color:#fff;padding:14px 20px;border-radius:12px;
          flex:1;min-width:180px;border-left:4px solid #38bdf8">
          <span style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase">Estado</span>
          <h3 style="margin:5px 0 0;font-size:18px;color:#22c55e">🟢 Operativo</h3>
        </div>
        <div style="background:#0f172a;color:#fff;padding:14px 20px;border-radius:12px;
          flex:1;min-width:180px;border-left:4px solid #f59e0b">
          <span style="font-size:11px;color:#94a3b8;font-weight:700;text-transform:uppercase">Canchas</span>
          <h3 style="margin:5px 0 0;font-size:18px">${canchas.length} disponibles</h3>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
        gap:18px;width:100%;grid-column:1/-1">`;

    canchas.forEach(c => {
      const slotsHtml = franjas.map(h => {
        const ocupada = reservas.some(r =>
          r.cancha_id === c.id &&
          (r.fecha||'').split('T')[0] === hoy &&
          (r.hora||'').trim().toUpperCase() === h.trim().toUpperCase()
        );
        return ocupada
          ? `<button disabled style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;
               padding:5px 9px;border-radius:6px;font-size:10px;font-weight:700;
               cursor:not-allowed;width:auto">🔴 ${h}</button>`
          : `<button onclick="abrirModalReserva(${c.id},'${hoy}','${maxFecha}','${h}')"
               style="background:#f0fdf4;color:#166534;border:1px solid #86efac;
               padding:5px 9px;border-radius:6px;font-size:10px;font-weight:700;
               cursor:pointer;width:auto;transition:background .15s"
               onmouseover="this.style.background='#dcfce7'"
               onmouseout="this.style.background='#f0fdf4'">🟢 ${h}</button>`;
      }).join('');

      const adminBtns = esAdmin() ? `
        <button onclick="eliminarCanchaAdmin(${c.id})"
          style="background:#ef4444;color:#fff;border:none;padding:6px 10px;
          border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;
          width:auto;margin-top:10px">🗑️ Eliminar cancha</button>` : '';

      html += `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;
          padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.04);
          display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="background:#dcfce7;color:#166534;padding:3px 9px;
              border-radius:6px;font-size:11px;font-weight:700">
              ${sedeActual.toUpperCase()} · Fútbol 6</span>
            <span style="font-size:12px;color:#94a3b8;font-weight:600">ID #${c.id}</span>
          </div>
          <h3 style="margin:0;color:#0f172a;font-size:17px">${c.nombre}</h3>
          <p style="margin:0;color:#475569;font-size:13px">
            <strong>Tipo:</strong> ${c.tipo} &nbsp;|&nbsp;
            <strong>Tarifa:</strong> <span style="color:#16a34a;font-weight:700">$${Number(c.precio).toLocaleString()}/h</span>
          </p>
          <p style="margin:0;font-size:12px;font-weight:600;color:#334155">Horarios disponibles hoy:</p>
          <div style="display:flex;gap:6px;flex-wrap:wrap">${slotsHtml}</div>
          <button onclick="abrirModalReserva(${c.id},'${hoy}','${maxFecha}','')"
            style="background:#0f172a;color:#fff;border:none;padding:9px;
            border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;width:100%">
            📅 Elegir otro día o semana
          </button>
          ${adminBtns}
        </div>`;
    });

    html += '</div>';
    contenedor.innerHTML = html;

  } catch (e) {
    console.error(e);
    contenedor.innerHTML = `<p style="text-align:center;color:#ef4444;padding:20px">
      Error al cargar las canchas. Verifica la conexión.</p>`;
  }
}

// Modal de reserva
function abrirModalReserva(canchaId, minFecha, maxFecha, hora) {
  if (!getToken()) return toast('Inicia sesión para reservar.', 'warn');

  canchaReservaId = canchaId;
  const modal = document.getElementById('modal-reserva');
  if (!modal) return;

  modal.style.display = 'flex';
  document.getElementById('modal-cancha-nombre').textContent =
    `Cancha #${canchaId} — ${sedeActual} (Fútbol 6)`;

  const fi = document.getElementById('reserva-fecha');
  if (fi) { fi.value = minFecha || ''; fi.min = minFecha || ''; fi.max = maxFecha || ''; }

  const hi = document.getElementById('reserva-hora');
  if (hi && hora) hi.value = hora;

  const ci = document.getElementById('reserva-cliente');
  if (ci) ci.value = getCorreo().split('@')[0] || 'Jugador';

  // Re-vincular botón para evitar listeners duplicados
  const btn = document.getElementById('btn-enviar-reserva');
  if (btn) {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', enviarReserva);
  }
}

function cerrarModalReserva() {
  const m = document.getElementById('modal-reserva');
  if (m) m.style.display = 'none';
}

async function enviarReserva() {
  const fecha   = document.getElementById('reserva-fecha')?.value;
  const hora    = document.getElementById('reserva-hora')?.value;
  const cliente = document.getElementById('reserva-cliente')?.value?.trim();

  if (!fecha || !hora || !cliente)
    return toast('Completa todos los campos de la reserva.', 'warn');

  const { ok, data } = await api('/reservas', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ cancha_id: canchaReservaId, fecha, hora, cliente })
  });

  if (!ok) return toast(data.error || 'No se pudo confirmar la reserva.', 'error');

  toast('Reserva confirmada. ¡A jugar!');
  cerrarModalReserva();
  obtenerCanchas();
}

async function eliminarCanchaAdmin(id) {
  if (!confirm(`¿Eliminar la cancha #${id} y todas sus reservas asociadas?`)) return;
  const { ok, data } = await api(`/canchas/${id}`, {
    method: 'DELETE', headers: authHeader()
  });
  if (!ok) return toast(data.error || 'No se pudo eliminar.', 'error');
  toast(data.mensaje || 'Cancha eliminada.');
  obtenerCanchas();
}

// ═══════════════════════════════════════════════════════════
//  PARTIDOS ABIERTOS
// ═══════════════════════════════════════════════════════════
async function obtenerPartidos() {
  const ctn = document.getElementById('contenedor-partidos');
  if (!ctn) return;
  ctn.innerHTML = `<p style="text-align:center;color:#64748b;padding:20px">Cargando partidos…</p>`;

  const { ok, data: partidos } = await api(`/partidos?sede=${encodeURIComponent(sedeActual)}`);
  ctn.innerHTML = '';

  if (!ok || !partidos.length) {
    ctn.innerHTML = `<p style="text-align:center;color:#64748b;width:100%;padding:20px">
      No hay partidos abiertos en ${sedeActual || 'esta sede'}. ¡Crea el primero!</p>`;
    return;
  }

  partidos.forEach(p => {
    const cuposOcupados = p.cupos_totales - p.cupos_disponibles;
    const pct = Math.round((cuposOcupados / p.cupos_totales) * 100);
    const adminBtn = esAdminOAyudante()
      ? `<button onclick="eliminarPartidoAdmin(${p.id})"
           style="background:#ef4444;color:#fff;border:none;padding:6px 10px;
           border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;
           width:100%;margin-top:8px">🗑️ Eliminar partido</button>` : '';

    const d = document.createElement('div');
    d.className = 'tarjeta-cancha';
    d.innerHTML = `
      <h3 style="margin:0 0 8px">${p.modalidad} — Fútbol 6</h3>
      <p style="margin:3px 0;font-size:13px"><strong>Cancha:</strong> ${p.nombre_cancha}</p>
      <p style="margin:3px 0;font-size:13px"><strong>Fecha / Hora:</strong>
        ${(p.fecha||'').split('T')[0]} · ${p.hora}</p>
      <p style="margin:3px 0;font-size:13px"><strong>Nivel:</strong> ${p.nivel}</p>
      ${p.posicion_requerida
        ? `<p style="margin:3px 0;font-size:13px"><strong>Buscando:</strong> ${p.posicion_requerida}</p>`
        : ''}
      <p style="margin:3px 0;font-size:13px"><strong>Creador:</strong> ${p.creador || 'Jugador'}</p>
      <div style="margin:10px 0 4px">
        <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:#22c55e;border-radius:3px;
            transition:width .4s"></div>
        </div>
        <p style="margin:4px 0;font-size:12px;color:#22c55e;font-weight:700">
          Cupos: ${p.cupos_disponibles} libres / ${p.cupos_totales} totales</p>
      </div>
      <button onclick="unirsePartido(${p.id})"
        style="background:#2563eb;color:#fff;border:none;padding:9px;
        border-radius:8px;cursor:pointer;font-size:13px;font-weight:700;width:100%">
        ⚡ Unirme al partido</button>
      ${adminBtn}`;
    ctn.appendChild(d);
  });
}

async function crearPartido() {
  if (!getToken()) return toast('Inicia sesión para publicar un partido.', 'warn');
  const payload = decodeToken(getToken());
  if (!payload) return toast('Sesión inválida.', 'error');

  const cancha_id         = parseInt(document.getElementById('p-cancha')?.value);
  const fecha             = document.getElementById('p-fecha')?.value;
  const hora              = document.getElementById('p-hora')?.value?.trim();
  const modalidad         = document.getElementById('p-modalidad')?.value?.trim();
  const nivel             = document.getElementById('p-nivel')?.value?.trim();
  const posicion_requerida= document.getElementById('p-posicion')?.value?.trim();
  const cupos_totales     = parseInt(document.getElementById('p-cupos')?.value);

  if (!cancha_id || !fecha || !hora || !modalidad || !nivel || !cupos_totales)
    return toast('Completa todos los campos obligatorios.', 'warn');
  if (cupos_totales < 2 || cupos_totales > 22)
    return toast('Los cupos deben ser entre 2 y 22 jugadores.', 'warn');

  const { ok, data } = await api('/partidos', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({
      creador_id: payload.id, cancha_id, fecha, hora, modalidad,
      nivel, posicion_requerida, cupos_totales, sede: sedeActual
    })
  });

  if (!ok) return toast(data.error || 'No se pudo publicar.', 'error');
  toast(data.mensaje || 'Partido publicado.');
  ['p-cancha','p-fecha','p-hora','p-modalidad','p-nivel','p-posicion','p-cupos']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  obtenerPartidos();
}

async function unirsePartido(id) {
  if (!getToken()) return toast('Inicia sesión para unirte.', 'warn');
  const { ok, data } = await api(`/partidos/${id}/unirse`, {
    method: 'PUT', headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  if (!ok) return toast(data.error || 'No se pudo unir al partido.', 'error');
  toast(`${data.mensaje} (${data.cupos_restantes} cupos restantes)`);
  obtenerPartidos();
}

async function eliminarPartidoAdmin(id) {
  if (!confirm(`¿Eliminar el partido #${id}?`)) return;
  const { ok, data } = await api(`/partidos/${id}`, {
    method: 'DELETE', headers: authHeader()
  });
  if (!ok) return toast(data.error || 'Error al eliminar.', 'error');
  toast(data.mensaje || 'Partido eliminado.');
  obtenerPartidos();
}

// ═══════════════════════════════════════════════════════════
//  TORNEOS
// ═══════════════════════════════════════════════════════════
async function obtenerTorneos() {
  const ctn = document.getElementById('contenedor-torneos');
  const sel = document.getElementById('t-id');
  if (!ctn) return;
  ctn.innerHTML = `<p style="text-align:center;color:#64748b;padding:20px">Cargando torneos…</p>`;
  if (sel) sel.innerHTML = '<option value="">Selecciona un torneo activo…</option>';

  const { ok, data: torneos } = await api(`/torneos?sede=${encodeURIComponent(sedeActual)}`);
  ctn.innerHTML = '';

  if (!ok || !torneos.length) {
    ctn.innerHTML = `<p style="text-align:center;color:#64748b;width:100%;padding:20px">
      No hay torneos activos en ${sedeActual || 'esta sede'}. ¡Crea el primero!</p>`;
    return;
  }

  torneos.forEach(t => {
    const cerrado = t.estado === 'cerrado' || t.cupos_inscritos >= t.cupos_totales;
    const pct = t.cupos_totales
      ? Math.round((t.cupos_inscritos / t.cupos_totales) * 100) : 0;
    const adminBtns = esAdmin() ? `
      <div style="display:flex;gap:8px;margin-top:10px">
        <button onclick="editarTorneoPrompt(${t.id},'${escHtml(t.nombre)}','${escHtml(t.modalidad)}',${t.cupos_totales})"
          style="background:#38bdf8;color:#0f172a;border:none;padding:6px 10px;
          border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;flex:1">✏️ Editar</button>
        <button onclick="eliminarTorneoAdmin(${t.id})"
          style="background:#ef4444;color:#fff;border:none;padding:6px 10px;
          border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;flex:1">🗑️ Eliminar</button>
      </div>` : '';

    const d = document.createElement('div');
    d.className = 'tarjeta-cancha';
    d.innerHTML = `
      <h3 style="margin:0 0 6px">${escHtml(t.nombre)}</h3>
      <p style="margin:3px 0;font-size:13px;color:#64748b">${escHtml(t.descripcion||'Sin descripción')}</p>
      <p style="margin:6px 0;font-size:13px"><strong>Modalidad:</strong> ${escHtml(t.modalidad)} · Fútbol 6</p>
      <p style="margin:3px 0;font-size:13px"><strong>Estado:</strong>
        <span style="color:${cerrado?'#ef4444':'#22c55e'};font-weight:700">
          ${cerrado?'🔒 Cerrado':'🟢 Abierto'}</span></p>
      <div style="margin:10px 0 4px">
        <div style="height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cerrado?'#ef4444':'#22c55e'};
            border-radius:3px;transition:width .4s"></div>
        </div>
        <p style="margin:4px 0;font-size:12px;color:#f59e0b;font-weight:700">
          ${t.cupos_inscritos} / ${t.cupos_totales} equipos inscritos</p>
      </div>
      ${adminBtns}`;
    ctn.appendChild(d);

    if (sel && !cerrado) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.nombre} (${t.modalidad} · ${t.cupos_inscritos}/${t.cupos_totales})`;
      sel.appendChild(opt);
    }
  });
}

async function crearTorneo() {
  const nombre       = document.getElementById('t-nombre')?.value?.trim();
  const descripcion  = document.getElementById('t-desc')?.value?.trim();
  const modalidad    = document.getElementById('t-mod')?.value?.trim();
  const cupos_totales= parseInt(document.getElementById('t-cupos-totales')?.value);

  if (!nombre || !modalidad || !cupos_totales)
    return toast('Completa nombre, modalidad y cupos del torneo.', 'warn');
  if (cupos_totales < 2 || cupos_totales > 32)
    return toast('El torneo debe tener entre 2 y 32 equipos.', 'warn');

  const { ok, data } = await api('/torneos', {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ nombre, descripcion, modalidad, cupos_totales, sede: sedeActual })
  });

  if (!ok) return toast(data.error || 'No se pudo crear el torneo.', 'error');
  toast(data.mensaje || 'Torneo creado.');
  ['t-nombre','t-desc','t-mod','t-cupos-totales'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value='';
  });
  obtenerTorneos();
}

async function editarTorneoPrompt(id, nombre, modalidad, cupos) {
  const nuevoNombre   = prompt('Nombre del torneo:', nombre);
  if (nuevoNombre === null) return;
  const nuevaModalidad= prompt('Modalidad:', modalidad);
  if (nuevaModalidad === null) return;
  const nuevosCupos   = prompt('Cupos totales:', cupos);
  if (nuevosCupos === null) return;

  if (!nuevoNombre.trim() || !nuevaModalidad.trim() || isNaN(parseInt(nuevosCupos)))
    return toast('Datos inválidos.', 'warn');

  const { ok, data } = await api(`/torneos/${id}`, {
    method: 'PUT',
    headers: authHeader(),
    body: JSON.stringify({
      nombre: nuevoNombre.trim(),
      modalidad: nuevaModalidad.trim(),
      cupos_totales: parseInt(nuevosCupos)
    })
  });

  if (!ok) return toast(data.error || 'No se pudo actualizar.', 'error');
  toast(data.mensaje || 'Torneo actualizado.');
  obtenerTorneos();
}

async function eliminarTorneoAdmin(id) {
  if (!confirm(`¿Eliminar el torneo #${id} y todas sus inscripciones?`)) return;
  const { ok, data } = await api(`/torneos/${id}`, {
    method: 'DELETE', headers: authHeader()
  });
  if (!ok) return toast(data.error || 'Error al eliminar.', 'error');
  toast(data.mensaje || 'Torneo eliminado.');
  obtenerTorneos();
}

async function inscribirEquipo() {
  if (!getToken()) return toast('Inicia sesión para inscribir tu equipo.', 'warn');
  const payload = decodeToken(getToken());
  if (!payload) return toast('Sesión inválida.', 'error');

  const torneoId    = parseInt(document.getElementById('t-id')?.value);
  const nombre_equipo = document.getElementById('t-equipo')?.value?.trim();

  if (!torneoId || !nombre_equipo)
    return toast('Selecciona un torneo e ingresa el nombre del equipo.', 'warn');

  const { ok, data } = await api(`/torneos/${torneoId}/inscribir`, {
    method: 'POST',
    headers: authHeader(),
    body: JSON.stringify({ capitan_id: payload.id, nombre_equipo })
  });

  if (!ok) return toast(data.error || 'No se pudo inscribir.', 'error');
  toast(data.mensaje || 'Equipo inscrito.');
  document.getElementById('t-equipo').value = '';
  obtenerTorneos();
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD ADMIN
// ═══════════════════════════════════════════════════════════
async function cargarDashboardAdmin() {
  try {
    const token = getToken();
    const [rRes, rTorn, rPart, rUser] = await Promise.all([
      api('/reservas',   { headers: { 'Authorization': `Bearer ${token}` } }),
      api('/torneos'),
      api('/partidos'),
      api('/auth/usuarios', { headers: { 'Authorization': `Bearer ${token}` } })
    ]);

    dashboardData = {
      reservas : rRes.ok  ? rRes.data  : [],
      torneos  : rTorn.ok ? rTorn.data : [],
      partidos : rPart.ok ? rPart.data : [],
      usuarios : rUser.ok ? rUser.data : []
    };

    setInner('stat-reservas', dashboardData.reservas.length);
    setInner('stat-torneos',  dashboardData.torneos.filter(t=>t.estado!=='cerrado').length);
    setInner('stat-partidos', dashboardData.partidos.length);
    setInner('stat-usuarios', dashboardData.usuarios.length);

    mostrarDetalleDashboard('reservas');
  } catch(e) {
    console.error('Dashboard error:', e);
  }
}

function setInner(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function mostrarDetalleDashboard(tipo) {
  const titulo = document.getElementById('dashboard-titulo-seccion');
  const ctn    = document.getElementById('dashboard-contenido-dinamico');
  if (!ctn) return;
  ctn.innerHTML = '';

  const tableWrap = (head, rows) => `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f1f5f9">
            ${head.map(h=>`<th style="padding:10px 12px;text-align:left;font-weight:700;
              color:#334155;border-bottom:2px solid #e2e8f0">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  if (tipo === 'reservas') {
    if (titulo) titulo.textContent = '📋 Gestión de Reservas';
    const d = dashboardData.reservas;
    if (!d.length) { ctn.innerHTML = '<p style="padding:20px;color:#64748b">Sin reservas activas.</p>'; return; }
    ctn.innerHTML = tableWrap(
      ['ID','Cancha','Fecha / Hora','Cliente','Acción'],
      d.map(r=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 12px">#${r.id}</td>
        <td style="padding:9px 12px">${r.nombre_cancha||'Cancha #'+r.cancha_id}</td>
        <td style="padding:9px 12px">${(r.fecha||'').split('T')[0]} · ${r.hora||''}</td>
        <td style="padding:9px 12px">👤 ${r.usuario_correo||r.cliente||'Socio'}</td>
        <td style="padding:9px 12px">
          <button onclick="eliminarReservaAdmin(${r.id})"
            style="background:#ef4444;color:#fff;border:none;padding:5px 10px;
            border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;width:auto">
            🗑️ Liberar</button></td>
      </tr>`).join('')
    );
  } else if (tipo === 'torneos') {
    if (titulo) titulo.textContent = '🏆 Torneos Activos';
    const d = dashboardData.torneos;
    if (!d.length) { ctn.innerHTML = '<p style="padding:20px;color:#64748b">Sin torneos.</p>'; return; }
    ctn.innerHTML = tableWrap(
      ['ID','Nombre','Modalidad','Equipos','Estado'],
      d.map(t=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 12px">#${t.id}</td>
        <td style="padding:9px 12px;font-weight:600">${escHtml(t.nombre)}</td>
        <td style="padding:9px 12px">${escHtml(t.modalidad)}</td>
        <td style="padding:9px 12px">${t.cupos_inscritos} / ${t.cupos_totales}</td>
        <td style="padding:9px 12px">
          <span style="background:${t.estado==='cerrado'?'#fee2e2':'#dcfce7'};
            color:${t.estado==='cerrado'?'#991b1b':'#166534'};
            padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700">
            ${t.estado||'abierto'}</span></td>
      </tr>`).join('')
    );
  } else if (tipo === 'partidos') {
    if (titulo) titulo.textContent = '⚽ Partidos Abiertos';
    const d = dashboardData.partidos;
    if (!d.length) { ctn.innerHTML = '<p style="padding:20px;color:#64748b">Sin partidos abiertos.</p>'; return; }
    ctn.innerHTML = tableWrap(
      ['ID','Cancha','Modalidad','Fecha / Hora','Cupos'],
      d.map(p=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 12px">#${p.id}</td>
        <td style="padding:9px 12px">${p.nombre_cancha||'—'}</td>
        <td style="padding:9px 12px">${escHtml(p.modalidad)} (${escHtml(p.nivel)})</td>
        <td style="padding:9px 12px">${(p.fecha||'').split('T')[0]} · ${p.hora||''}</td>
        <td style="padding:9px 12px;color:#22c55e;font-weight:700">
          ${p.cupos_disponibles}/${p.cupos_totales}</td>
      </tr>`).join('')
    );
  } else if (tipo === 'usuarios') {
    if (titulo) titulo.textContent = '👥 Usuarios del Sistema';
    const d = dashboardData.usuarios;
    if (!d.length) { ctn.innerHTML = '<p style="padding:20px;color:#64748b">Sin usuarios o sin permisos.</p>'; return; }
    ctn.innerHTML = tableWrap(
      ['ID','Nombre','Correo','Rol'],
      d.map(u=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:9px 12px">#${u.id}</td>
        <td style="padding:9px 12px;font-weight:600">${escHtml(u.nombre||'—')}</td>
        <td style="padding:9px 12px;color:#475569">${escHtml(u.correo||'—')}</td>
        <td style="padding:9px 12px">
          <span style="background:#eff6ff;color:#1d4ed8;padding:3px 8px;
            border-radius:6px;font-size:11px;font-weight:700">
            ${u.rol||'jugador'}</span></td>
      </tr>`).join('')
    );
  }
}

async function cargarReservasAdmin() {
  const ctn = document.getElementById('contenedor-gestion-reservas');
  if (!ctn) return;
  const { ok, data } = await api('/reservas/admin/todas', { headers: authHeader() });
  if (!ok || !data.length) { ctn.innerHTML = '<p>Sin reservas registradas.</p>'; return; }
  ctn.innerHTML = `<div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f1f5f9">
        ${['ID','Cancha','Cliente','Fecha / Hora','Acción'].map(h=>`<th style="padding:9px 12px;text-align:left;border-bottom:2px solid #e2e8f0">${h}</th>`).join('')}
      </tr></thead>
      <tbody>
        ${data.map(r=>`<tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:9px 12px">#${r.id}</td>
          <td style="padding:9px 12px">${r.nombre_cancha||'—'}</td>
          <td style="padding:9px 12px">${r.cliente||'Socio'}</td>
          <td style="padding:9px 12px">${(r.fecha||'').split('T')[0]} · ${r.hora||''}</td>
          <td style="padding:9px 12px">
            <button onclick="eliminarReservaAdmin(${r.id})"
              style="background:#ef4444;color:#fff;border:none;padding:5px 10px;
              border-radius:6px;cursor:pointer;font-size:11px;font-weight:700;width:auto">
              🗑️ Eliminar</button></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
}

async function eliminarReservaAdmin(id) {
  if (!confirm(`¿Liberar la reserva #${id}?`)) return;
  const { ok, data } = await api(`/reservas/${id}`, {
    method: 'DELETE', headers: authHeader()
  });
  if (!ok) return toast(data.error || 'Error al eliminar.', 'error');
  toast(data.mensaje || 'Reserva liberada.');
  cargarReservasAdmin();
  obtenerCanchas();
  cargarDashboardAdmin();
}

// ═══════════════════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════════════════
function scrollALogin() {
  document.getElementById('seccion-auth-principal')
    ?.scrollIntoView({ behavior: 'smooth' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
