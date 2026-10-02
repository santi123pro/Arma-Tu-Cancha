const API_URL = 'http://localhost:3000/api';
let sedeActual = ''; // Guardará la sede elegida (Wembley, Bombonera, Bernabéu)

// === 1. ARRANQUE DE LA PÁGINA ===
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    
    // Recuperamos la sede si ya estaba navegando
    sedeActual = localStorage.getItem('sedeActual') || ''; 

    if (token) {
        mostrarSesionIniciada();
    } else {
        const vistaPortada = document.getElementById('vista-portada');
        if (vistaPortada) vistaPortada.style.setProperty('display', 'block', 'important');
        
        const authForms = document.getElementById('auth-forms');
        if (authForms) authForms.style.display = 'block';

        // Ocultar vistas de Marketplace y Presentación si no hay sesión
        const vistaMarketplace = document.getElementById('vista-marketplace');
        if (vistaMarketplace) vistaMarketplace.style.display = 'none';

        const vistaPresentacion = document.getElementById('vista-presentacion-sede');
        if (vistaPresentacion) vistaPresentacion.style.display = 'none';
    }

    const btnCrear = document.getElementById('btn-crear-partido');
    if (btnCrear) btnCrear.addEventListener('click', crearPartido);

    const btnCrearTorneo = document.getElementById('btn-crear-torneo');
    if (btnCrearTorneo) btnCrearTorneo.addEventListener('click', crearTorneo);

    const btnInscribir = document.getElementById('btn-inscribir-torneo');
    if (btnInscribir) btnInscribir.addEventListener('click', inscribirEquipo);
});

// === 2. NOTIFICACIONES TOAST ===
function mostrarToast(mensaje, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${tipo === 'success' ? '#27ae60' : '#e74c3c'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        pointer-events: auto;
        text-align: center;
    `;
    toast.innerText = mensaje;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0px)';
    }, 10);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// === 3. AUTH (LOGIN Y REGISTRO) ===
async function registrarUsuarioNuevo() {
    const nombre = document.getElementById('reg-nombre').value;
    const correo = document.getElementById('reg-correo').value;
    const password = document.getElementById('reg-clave').value;

    if (!nombre || !correo || !password) {
        return mostrarToast('⚠️ Llena todos los campos para registrarte.', 'error');
    }

    try {
        const res = await fetch(`${API_URL}/auth/registro`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, correo, password })
        });
        
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje + ' ¡Ya puedes iniciar sesión!', 'success');
        document.getElementById('reg-nombre').value = '';
        document.getElementById('reg-correo').value = '';
        document.getElementById('reg-clave').value = '';
        document.getElementById('correo').value = correo;
    } catch (e) {
        mostrarToast('Error en el servidor.', 'error');
    }
}

async function iniciarSesion() {
    const correo = document.getElementById('correo').value;
    const password = document.getElementById('password').value;

    if (!correo || !password) return alert('Ingresa correo y contraseña.');

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, password })
        });
        const data = await res.json();
        
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        localStorage.setItem('token', data.token);
        localStorage.setItem('correo', correo);
        
        mostrarToast('✅ ' + data.mensaje, 'success');
        mostrarSesionIniciada();
    } catch (e) {
        mostrarToast('Error en el servidor.', 'error');
    }
}

function cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('correo');
    localStorage.removeItem('rol');
    localStorage.removeItem('sedeActual');
    sedeActual = ''; 
    
    const vistaPortada = document.getElementById('vista-portada');
    if (vistaPortada) vistaPortada.style.setProperty('display', 'block', 'important');

    const authForms = document.getElementById('auth-forms');
    if (authForms) authForms.style.display = 'block';

    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.style.display = 'none';

    const seccionCanchas = document.getElementById('seccion-canchas');
    if (seccionCanchas) seccionCanchas.style.display = 'none';

    const vistaMarketplace = document.getElementById('vista-marketplace');
    if (vistaMarketplace) vistaMarketplace.style.display = 'none';

    const vistaPresentacion = document.getElementById('vista-presentacion-sede');
    if (vistaPresentacion) vistaPresentacion.style.display = 'none';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    mostrarToast('Sesión cerrada.', 'success');
}

// === 4. NAVEGACIÓN DEL MARKETPLACE (LOBBY) ===
function mostrarSesionIniciada() {
    const vistaPortada = document.getElementById('vista-portada');
    if (vistaPortada) vistaPortada.style.setProperty('display', 'none', 'important');

    const authForms = document.getElementById('auth-forms');
    if (authForms) authForms.style.display = 'none';

    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.style.display = 'block';

    const token = localStorage.getItem('token');
    let rolUsuario = 'jugador';
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        rolUsuario = payload.rol || 'jugador';
        localStorage.setItem('rol', rolUsuario); 
    } catch (e) {
        console.error("Error leyendo el rol del token", e);
    }

    const correoUsuario = localStorage.getItem('correo') || 'Usuario';
    const spanSaludo = document.getElementById('saludo-usuario');
    if (spanSaludo) {
        spanSaludo.innerHTML = `👤 <strong>${correoUsuario.split('@')[0]}</strong> <span style="font-size: 11px; background: #38bdf8; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">${rolUsuario}</span> &nbsp;|&nbsp; `;
    }

    const btnDashboard = document.getElementById('btn-tab-dashboard');
    if (btnDashboard) {
        if (rolUsuario === 'admin' || rolUsuario === 'ayudante') {
            btnDashboard.style.display = 'inline-block';
            cargarDashboardAdmin(); 
        } else {
            btnDashboard.style.display = 'none';
        }
    }

    const seccionCanchas = document.getElementById('seccion-canchas');
    if (seccionCanchas) seccionCanchas.style.display = 'none';

    const vistaPresentacion = document.getElementById('vista-presentacion-sede');
    if (vistaPresentacion) vistaPresentacion.style.display = 'none';

    const vistaMarketplace = document.getElementById('vista-marketplace');
    if (vistaMarketplace) vistaMarketplace.style.display = 'block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function abrirSede(nombre) {
    sedeActual = nombre; 
    localStorage.setItem('sedeActual', nombre); 
    let descripcionLarga = '';
    let colorBanner = '';
    let caracteristicas = [];

    if (nombre === 'Wembley') {
        descripcionLarga = '¡Bienvenido a la sede principal! Wembley Norte cuenta con canchas de grama sintética de última generación. Es el lugar perfecto para jugar a nivel semiprofesional con tus amigos. ¡Velocidad, buen pique del balón y el mejor ambiente futbolero de la ciudad!';
        colorBanner = 'linear-gradient(135deg, #1e3a8a, #3b82f6)';
        caracteristicas = ['📍 Parqueadero gratis', '🚿 Camerinos VIP', '🍔 Zona de comidas', '🕒 Abierto hasta media noche'];
    } 
    else if (nombre === 'La Bombonera') {
        descripcionLarga = '¡Entraste a la caldera! La Bombonera es para los que juegan al límite. Aquí el fútbol se siente, se respira y se suda. Canchas de cemento pulido y sintética para un juego rápido, físico y lleno de pura pasión barrial.';
        colorBanner = 'linear-gradient(135deg, #b45309, #eab308)';
        caracteristicas = ['🔥 Gradería cercana', '🚿 Duchas básicas', '🍺 Bebidas frías', '⚽ Balones pesados'];
    } 
    else if (nombre === 'Bernabéu') {
        descripcionLarga = 'La Casa Blanca del fútbol amateur. El Bernabéu te ofrece instalaciones de primera categoría, iluminación LED profesional y grama sintética premium. Si te gusta el juego limpio, el toque de primera y la elegancia, este es tu lugar.';
        colorBanner = 'linear-gradient(135deg, #334155, #94a3b8)';
        caracteristicas = ['👑 Instalaciones Premium', '💡 Iluminación LED', '🚗 Valet Parking', '🏆 Marcador Digital'];
    }

    document.getElementById('vista-marketplace').style.display = 'none';
    
    // Inyectamos el diseño rediseñado a pantalla completa en la vista de presentación
    const vistaPresentacion = document.getElementById('vista-presentacion-sede');
    vistaPresentacion.innerHTML = `
        <div style="width: 100%;">
            <!-- Botón de retorno sutil arriba -->
            <div style="max-width: 1100px; margin: 0 auto 15px auto; padding: 0 20px;">
                <button onclick="volverAlMarketplace()" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 14px; font-weight: bold;">← Volver a los complejos</button>
            </div>

            <!-- Hero Banner de la Sede a ancho completo -->
            <div id="sede-banner" style="background: ${colorBanner}; width: 100%; padding: 60px 20px; text-align: center; color: white; box-shadow: 0 10px 25px rgba(0,0,0,0.2); margin-bottom: 40px;">
                <h1 id="sede-titulo" style="font-size: 42px; margin: 0 0 15px 0; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">🏟️ ${nombre}</h1>
                <p id="sede-descripcion" style="max-width: 750px; margin: 0 auto; font-size: 16px; line-height: 1.6; color: #f1f5f9;">${descripcionLarga}</p>
            </div>

            <!-- Contenido de la Sede -->
            <div style="max-width: 1000px; margin: 0 auto; padding: 0 20px; text-align: center;">
                <h3 style="color: #f8fafc; font-size: 20px; margin-bottom: 25px; text-transform: uppercase; letter-spacing: 1px;">Servicios y Comodidades</h3>
                
                <div id="sede-caracteristicas" style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-bottom: 50px;">
                    <!-- Se inyectarán dinámicamente -->
                </div>

                <!-- Sección de Acción / Juega Ya -->
                <div style="background: #1e293b; border: 1px solid #334155; padding: 40px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); margin-bottom: 60px;">
                    <h2 style="color: white; margin: 0 0 10px 0; font-size: 26px;">¿Todo listo para pisar la cancha?</h2>
                    <p style="color: #94a3b8; margin: 0 t0 25px 0; font-size: 14px;">Revisa la disponibilidad de horarios, partidos abiertos y torneos activos de esta sede.</p>
                    <button onclick="activarJuegaYa()" style="background: #27ae60; color: white; border: none; padding: 14px 40px; font-size: 16px; font-weight: bold; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(39, 174, 96, 0.4); transition: all 0.2s;">⚡ JUEGA YA</button>
                </div>
            </div>
        </div>
    `;

    const contenedorCarac = document.getElementById('sede-caracteristicas');
    contenedorCarac.innerHTML = '';
    caracteristicas.forEach(carac => {
        contenedorCarac.innerHTML += `<span style="background: #1e293b; color: #38bdf8; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: bold; border: 1px solid #334155; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">${carac}</span>`;
    });
    
    vistaPresentacion.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === 5. CANCHAS Y RESERVAS (CON FILTRO DE SEDE Y FECHA) ===
async function obtenerCanchas() {
    try {
        const [resCanchas, resReservas] = await Promise.all([
            fetch(`${API_URL}/canchas?sede=${encodeURIComponent(sedeActual)}`),
            fetch(`${API_URL}/reservas?sede=${encodeURIComponent(sedeActual)}`)
        ]);

        const canchas = await resCanchas.json();
        const reservas = resReservas.ok ? await resReservas.json() : [];
        
        const contenedor = document.getElementById('contenedor-canchas');
        if (!contenedor) return;
        
        contenedor.innerHTML = `
            <div class="dashboard-metrics" style="grid-column: 1 / -1; display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">
                <div class="metric-card" style="background: #1e293b; color: white; padding: 15px 20px; border-radius: 12px; flex: 1; min-width: 200px; border-left: 4px solid #27ae60;">
                    <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Complejo Activo</span>
                    <h3 style="margin: 5px 0 0 0; font-size: 20px;">🏟️ ${sedeActual || 'Wembley'}</h3>
                </div>
                <div class="metric-card" style="background: #1e293b; color: white; padding: 15px 20px; border-radius: 12px; flex: 1; min-width: 200px; border-left: 4px solid #38bdf8;">
                    <span style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">Estado de la Sede</span>
                    <h3 style="margin: 5px 0 0 0; font-size: 20px; color: #27ae60;">🟢 Operativo</h3>
                </div>
            </div>
        `;

        const gridCanchas = document.createElement('div');
        gridCanchas.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; width: 100%; grid-column: 1 / -1;";

        const hoy = new Date();
        const fechaMinima = hoy.toISOString().split('T')[0];
        
        const maxDate = new Date();
        maxDate.setDate(hoy.getDate() + 7);
        const fechaMaxima = maxDate.toISOString().split('T')[0];

        const franjasHorarias = ["3:00 PM", "5:00 PM", "7:00 PM", "8:00 PM", "9:00 PM"];

        if (canchas.length === 0) {
            contenedor.innerHTML += `<p style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 20px;">No hay canchas configuradas en el sistema todavía.</p>`;
            return;
        }

        canchas.forEach(cancha => {
            const tarjeta = document.createElement('div');
            tarjeta.style.cssText = `
                background: white;
                border: 1px solid #e2e8f0;
                border-radius: 14px;
                padding: 22px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            `;
            
            let htmlHorarios = '<div style="display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0;">';
            
            franjasHorarias.forEach(hora => {
                // Verificamos si esta cancha está reservada EXTACTAMENTE en la fecha de hoy y hora específica
                const estaOcupada = reservas.some(r => 
                    r.cancha_id === cancha.id && 
                    r.fecha.split('T')[0] === fechaMinima && 
                    r.hora.trim().toUpperCase() === hora.trim().toUpperCase()
                );

                if (estaOcupada) {
                    htmlHorarios += `<button disabled style="background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: not-allowed; opacity: 0.7;">🔴 ${hora} ocupada</button>`;
                } else {
                    htmlHorarios += `<button onclick="hacerReservaLimitada(${cancha.id}, '${fechaMinima}', '${fechaMaxima}', '${hora}')" style="background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">🟢 ${hora} libre</button>`;
                }
            });
            htmlHorarios += '</div>';

            tarjeta.innerHTML = `
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span style="background: rgba(39, 174, 96, 0.1); color: #27ae60; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold;">${sedeActual ? sedeActual.toUpperCase() : 'DISPONIBLE'}</span>
                        <span style="font-size: 13px; color: #64748b; font-weight: bold;">ID #${cancha.id}</span>
                    </div>
                    <h3 style="margin: 0 0 4px 0; color: #0f172a; font-size: 18px;">${cancha.nombre}</h3>
                    <p style="margin: 0 0 8px 0; color: #475569; font-size: 13px;"><strong>Tipo:</strong> ${cancha.tipo} | <strong>Tarifa:</strong> $${cancha.precio}</p>
                    <p style="margin: 0 0 6px 0; color: #334155; font-size: 12px; font-weight: bold;">Selecciona un horario:</p>
                    ${htmlHorarios}
                </div>
                <button onclick="hacerReservaLimitada(${cancha.id}, '${fechaMinima}', '${fechaMaxima}', '8:00 PM')" class="btn-cta-secondary" style="width: 100%; padding: 8px; font-size: 12px; border-radius: 8px; cursor: pointer; background: #0f172a; color: white; border: none; margin-top: 10px;">📅 Elegir día específico</button>
            `;
            
            gridCanchas.appendChild(tarjeta);
        });

        contenedor.appendChild(gridCanchas);
    } catch (error) {
        console.error('Error cargando canchas:', error);
    }
}

let canchaSeleccionadaId = null;

function hacerReservaLimitada(canchaId, minFecha, maxFecha, horaSeleccionada = '8:00 PM') {
    const token = localStorage.getItem('token');
    if (!token) return mostrarToast('⚠️ Debes iniciar sesión para reservar.', 'error');

    canchaSeleccionadaId = canchaId;
    
    document.getElementById('modal-reserva').style.display = 'flex';
    document.getElementById('modal-cancha-nombre').innerText = `Estás reservando la Cancha ID: #${canchaId} (${horaSeleccionada})`;
    
    const inputFecha = document.getElementById('reserva-fecha');
    inputFecha.value = minFecha;
    inputFecha.min = minFecha;
    inputFecha.max = maxFecha;

    const selectHora = document.getElementById('reserva-hora');
    if (selectHora) selectHora.value = horaSeleccionada;

    document.getElementById('reserva-cliente').value = localStorage.getItem('correo') ? localStorage.getItem('correo').split('@')[0] : 'Socio';

    const btnConfirmar = document.getElementById('btn-enviar-reserva');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);

    document.getElementById('btn-enviar-reserva').addEventListener('click', enviarDatosReserva);
}

function cerrarModalReserva() {
    document.getElementById('modal-reserva').style.display = 'none';
}

async function enviarDatosReserva() {
    const token = localStorage.getItem('token');
    const fecha = document.getElementById('reserva-fecha').value;
    const hora = document.getElementById('reserva-hora').value;
    const cliente = document.getElementById('reserva-cliente').value;

    if (!fecha || !hora || !cliente) return mostrarToast('⚠️ Llena todos los campos.', 'error');

    try {
        const respuesta = await fetch(`${API_URL}/reservas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ cancha_id: canchaSeleccionadaId, fecha, hora, cliente })
        });

        if (respuesta.status === 204 || respuesta.ok) {
            mostrarToast('✅ ¡Reserva confirmada con éxito, bro!', 'success');
            cerrarModalReserva();
            obtenerCanchas(); 
            return;
        }

        const resultado = await respuesta.json();
        mostrarToast('❌ ' + (resultado.error || 'Error al reservar.'), 'error');

    } catch (error) {
        mostrarToast('Error al conectar con el servidor.', 'error');
    }
}

// === 6. PARTIDOS ABIERTOS ===
async function obtenerPartidos() {
    try {
        const res = await fetch(`${API_URL}/partidos?sede=${encodeURIComponent(sedeActual)}`);
        const partidos = await res.json();
        
        const contenedor = document.getElementById('contenedor-partidos');
        if (!contenedor) return;
        contenedor.innerHTML = '';

        if (partidos.length === 0) {
            contenedor.innerHTML = `<p style="text-align: center; color: #666; width:100%;">No hay partidos abiertos en ${sedeActual || 'esta sede'}. ¡Crea uno arriba!</p>`;
            return;
        }

        const rolUsuario = localStorage.getItem('rol');

        partidos.forEach(p => {
            const tarjeta = document.createElement('div');
            tarjeta.className = 'tarjeta-cancha';
            const infoPosicion = p.posicion_requerida ? `<p><strong>Buscando:</strong> ${p.posicion_requerida}</p>` : '';
            let botonEliminarPartido = '';

            if (rolUsuario === 'admin' || rolUsuario === 'ayudante') {
                botonEliminarPartido = `<button onclick="eliminarPartidoAdmin(${p.id})" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; width: 100%; margin-top: 8px;">🗑️ Eliminar Partido</button>`;
            }

            tarjeta.innerHTML = `
                <h3>${p.modalidad}</h3>
                <p><strong>Cancha:</strong> ${p.nombre_cancha}</p>
                <p><strong>Fecha:</strong> ${p.fecha.split('T')[0]} - ${p.hora}</p>
                <p><strong>Nivel:</strong> ${p.nivel}</p>
                ${infoPosicion}
                <p><strong>Creador:</strong> ${p.creador}</p>
                <p style="color: #27ae60; font-weight: bold;">Cupos: ${p.cupos_disponibles} / ${p.cupos_totales}</p>
                <button onclick="unirsePartido(${p.id})" style="background: #2980b9; margin-top: 10px; width: 100%;">Unirme al Partido</button>
                ${botonEliminarPartido}
            `;
            contenedor.appendChild(tarjeta);
        });
    } catch (e) {
        console.error('Error cargando partidos:', e);
    }
}

async function eliminarPartidoAdmin(partidoId) {
    if (!confirm(`¿Estás seguro de eliminar este partido abierto #${partidoId}?`)) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/partidos/${partidoId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje, 'success');
        obtenerPartidos(); 
    } catch (e) {
        mostrarToast('Error al eliminar.', 'error');
    }
}

async function crearPartido() {
    const token = localStorage.getItem('token');
    if (!token) return alert('Debes iniciar sesión.');

    let creador_id;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        creador_id = payload.id;
    } catch (e) {
        return mostrarToast('Token inválido.', 'error');
    }

    const cancha_id = parseInt(document.getElementById('p-cancha').value);
    const fecha = document.getElementById('p-fecha').value;
    const hora = document.getElementById('p-hora').value;
    const modalidad = document.getElementById('p-modalidad').value;
    const nivel = document.getElementById('p-nivel').value;
    const posicion_requerida = document.getElementById('p-posicion').value;
    const cupos_totales = parseInt(document.getElementById('p-cupos').value);

    if (!cancha_id || !fecha || !hora || !modalidad || !nivel || !cupos_totales) {
        return mostrarToast('⚠️ Llena los campos obligatorios.', 'error');
    }

    const datosPartido = { creador_id, cancha_id, fecha, hora, modalidad, nivel, posicion_requerida, cupos_totales, sede: sedeActual };

    try {
        const res = await fetch(`${API_URL}/partidos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(datosPartido)
        });
        
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ Error: ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje, 'success');
        obtenerPartidos();
    } catch (e) {
        mostrarToast('Error en servidor.', 'error');
    }
}

async function unirsePartido(partidoId) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Debes iniciar sesión.');
    try {
        const res = await fetch(`${API_URL}/partidos/${partidoId}/unirse`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        mostrarToast(`✅ ${data.mensaje}`, 'success');
        obtenerPartidos();
    } catch (e) {
        mostrarToast('Error al unirse.', 'error');
    }
}

// === 7. TORNEOS ===
async function obtenerTorneos() {
    try {
        const res = await fetch(`${API_URL}/torneos?sede=${encodeURIComponent(sedeActual)}`);
        const torneos = await res.json();
        
        const contenedor = document.getElementById('contenedor-torneos');
        const selectTorneo = document.getElementById('t-id');
        const rolUsuario = localStorage.getItem('rol');

        if (contenedor) contenedor.innerHTML = '';
        if (selectTorneo) selectTorneo.innerHTML = '<option value="">Selecciona un torneo activo...</option>';

        if (torneos.length === 0) {
            if (contenedor) contenedor.innerHTML = `<p style="text-align: center; color: #666; width:100%;">No hay torneos activos en ${sedeActual || 'esta sede'}. ¡Crea uno arriba!</p>`;
            return;
        }

        torneos.forEach(t => {
            const esCerrado = t.estado === 'cerrado' || t.cupos_inscritos >= t.cupos_totales;

            if (contenedor) {
                const tarjeta = document.createElement('div');
                tarjeta.className = 'tarjeta-cancha';
                const colorEstado = esCerrado ? '#e74c3c' : '#27ae60';
                const textoEstado = esCerrado ? '🔒 Cerrado (Cupos llenos)' : '🟢 Abierto';
                let botonesAdmin = '';

                if (rolUsuario === 'admin') {
                    botonesAdmin = `
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            <button onclick="modificarTorneoPrompt(${t.id}, '${t.nombre}', '${t.modalidad}', ${t.cupos_totales})" style="background: #38bdf8; color: #0f172a; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; flex: 1;">✏️ Modificar</button>
                            <button onclick="eliminarTorneoAdmin(${t.id})" style="background: #ef4444; color: white; border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: bold; flex: 1;">🗑️ Eliminar</button>
                        </div>
                    `;
                }

                tarjeta.innerHTML = `
                    <h3>${t.nombre}</h3>
                    <p><em>${t.descripcion || 'Sin descripción'}</em></p>
                    <p><strong>Modalidad:</strong> ${t.modalidad}</p>
                    <p><strong>Estado:</strong> <span style="color: ${colorEstado}; font-weight: bold;">${textoEstado}</span></p>
                    <p style="color: #e67e22; font-weight: bold;">Inscritos: ${t.cupos_inscritos} / ${t.cupos_totales}</p>
                    ${botonesAdmin}
                `;
                contenedor.appendChild(tarjeta);
            }

            if (selectTorneo && !esCerrado) {
                const option = document.createElement('option');
                option.value = t.id;
                option.textContent = `${t.nombre} (${t.modalidad} - Cupos: ${t.cupos_inscritos}/${t.cupos_totales})`;
                selectTorneo.appendChild(option);
            }
        });
    } catch (e) {
        console.error('Error cargando torneos:', e);
    }
}

async function crearTorneo() {
    const token = localStorage.getItem('token');
    const nombre = document.getElementById('t-nombre').value;
    const descripcion = document.getElementById('t-desc').value;
    const modalidad = document.getElementById('t-mod').value;
    const cupos_totales = parseInt(document.getElementById('t-cupos-totales').value);

    if (!nombre || !modalidad || !cupos_totales) return mostrarToast('⚠️ Llena los campos.', 'error');

    try {
        const res = await fetch(`${API_URL}/torneos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nombre, descripcion, modalidad, cupos_totales, sede: sedeActual })
        });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ Error: ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje, 'success');
        obtenerTorneos(); 
    } catch (e) {
        mostrarToast('Error de conexión con el servidor.', 'error');
    }
}

async function modificarTorneoPrompt(idTorneo, nombreActual, modalidadActual, cuposActuales) {
    const nuevoNombre = prompt("Nuevo nombre:", nombreActual);
    if (!nuevoNombre) return;
    const nuevaModalidad = prompt("Nueva modalidad:", modalidadActual);
    if (!nuevaModalidad) return;
    const nuevosCupos = prompt("Nuevos cupos:", cuposActuales);
    if (!nuevosCupos) return;

    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/torneos/${idTorneo}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ nombre: nuevoNombre, modalidad: nuevaModalidad, cupos_totales: parseInt(nuevosCupos) })
        });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje, 'success');
        obtenerTorneos();
    } catch (e) {
        mostrarToast('Error en el servidor.', 'error');
    }
}

async function eliminarTorneoAdmin(idTorneo) {
    if (!confirm(`¿Estás seguro de eliminar el torneo #${idTorneo}?`)) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/torneos/${idTorneo}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje, 'success');
        obtenerTorneos();        
    } catch (e) {
        mostrarToast('Error en el servidor.', 'error');
    }
}

async function inscribirEquipo() {
    const token = localStorage.getItem('token');
    let capitan_id;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        capitan_id = payload.id;
    } catch (e) { return mostrarToast('Token inválido.', 'error'); }

    const torneoId = parseInt(document.getElementById('t-id').value);
    const nombre_equipo = document.getElementById('t-equipo').value;

    if (!torneoId || !nombre_equipo) return mostrarToast('⚠️ Selecciona torneo y nombre.', 'error');

    try {
        const res = await fetch(`${API_URL}/torneos/${torneoId}/inscribir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ capitan_id, nombre_equipo })
        });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');

        mostrarToast('✅ ' + data.mensaje, 'success');
        obtenerTorneos(); 
    } catch (e) {
        mostrarToast('Error en servidor.', 'error');
    }
}

// === 8. ADMIN: DASHBOARD Y GESTIÓN GLOBAL ===
async function cargarReservasAdmin() {
    const token = localStorage.getItem('token');
    const contenedor = document.getElementById('contenedor-gestion-reservas');
    if (!contenedor) return;

    try {
        const res = await fetch(`${API_URL}/reservas/admin/todas`, { headers: { 'Authorization': `Bearer ${token}` } });
        const reservas = await res.json();
        if (!res.ok) return;

        if (reservas.length === 0) {
            contenedor.innerHTML = '<p>No hay reservas registradas.</p>';
            return;
        }

        let html = `<table style="width: 100%; text-align: left;"><thead><tr><th>ID</th><th>Cancha</th><th>Cliente</th><th>Fecha/Hora</th><th>Acción</th></tr></thead><tbody>`;
        reservas.forEach(r => {
            html += `<tr><td>#${r.id}</td><td>${r.nombre_cancha}</td><td>${r.cliente}</td><td>${r.fecha.split('T')[0]} - ${r.hora}</td>
                     <td><button onclick="eliminarReservaAdmin(${r.id})">Eliminar</button></td></tr>`;
        });
        html += `</tbody></table>`;
        contenedor.innerHTML = html;
    } catch (e) { console.error(e); }
}

async function eliminarReservaAdmin(idReserva) {
    if (!confirm(`¿Eliminar reserva #${idReserva}?`)) return;
    const token = localStorage.getItem('token');
    try {
        const res = await fetch(`${API_URL}/reservas/${idReserva}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) return mostrarToast('❌ ' + data.error, 'error');
        mostrarToast('✅ ' + data.mensaje, 'success');
        cargarReservasAdmin(); 
        obtenerCanchas();      
        cargarDashboardAdmin(); 
    } catch (e) { mostrarToast('Error.', 'error'); }
}

let datosDashboardGlobal = { reservas: [], torneos: [], partidos: [], usuarios: [] };

async function cargarDashboardAdmin() {
    const token = localStorage.getItem('token');
    try {
        const [resReservas, resTorneos, resPartidos, resUsuarios] = await Promise.all([
            fetch(`${API_URL}/reservas`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_URL}/torneos`),
            fetch(`${API_URL}/partidos`),
            fetch(`${API_URL}/auth/usuarios`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => ({ ok: false }))
        ]);

        datosDashboardGlobal.reservas = resReservas.ok ? await resReservas.json() : [];
        datosDashboardGlobal.torneos = resTorneos.ok ? await resTorneos.json() : [];
        datosDashboardGlobal.partidos = resPartidos.ok ? await resPartidos.json() : [];
        datosDashboardGlobal.usuarios = resUsuarios.ok ? await resUsuarios.json() : [];

        document.getElementById('stat-reservas').innerText = datosDashboardGlobal.reservas.length;
        document.getElementById('stat-torneos').innerText = datosDashboardGlobal.torneos.filter(t => t.estado !== 'cerrado').length;
        document.getElementById('stat-partidos').innerText = datosDashboardGlobal.partidos.length;
        document.getElementById('stat-usuarios').innerText = datosDashboardGlobal.usuarios.length;

        mostrarDetalleDashboard('reservas');
    } catch (e) { console.error('Error cargando el dashboard analítico:', e); }
}

function mostrarDetalleDashboard(tipo) {
    const tituloSeccion = document.getElementById('dashboard-titulo-seccion');
    const contenedor = document.getElementById('dashboard-contenido-dinamico');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    if (tipo === 'reservas') {
        tituloSeccion.innerText = '📋 Gestión de Reservas Actuales';
        const reservas = datosDashboardGlobal.reservas;
        if (reservas.length === 0) return contenedor.innerHTML = `<p>No hay reservas activas.</p>`;
        
        let html = `<table style="width: 100%; text-align: left;"><thead><tr><th>ID</th><th>Cancha</th><th>Fecha/Hora</th><th>Usuario</th><th>Acción</th></tr></thead><tbody>`;
        reservas.forEach(r => {
            html += `<tr><td>#${r.id}</td><td>${r.nombre_cancha || 'Cancha #' + r.cancha_id}</td><td>${r.fecha ? r.fecha.split('T')[0] : 'N/A'} - ${r.hora}</td><td>👤 ${r.usuario_correo || r.correo || r.cliente || 'Socio'}</td>
                     <td><button onclick="eliminarReservaAdmin(${r.id})" style="color:red;">🗑️ Liberar</button></td></tr>`;
        });
        html += `</tbody></table>`;
        contenedor.innerHTML = html;

    } else if (tipo === 'torneos') {
        tituloSeccion.innerText = '🏆 Torneos Activos';
        const torneos = datosDashboardGlobal.torneos;
        if (torneos.length === 0) return contenedor.innerHTML = `<p>No hay torneos registrados.</p>`;
        
        let html = `<table style="width: 100%; text-align: left;"><thead><tr><th>ID</th><th>Nombre</th><th>Modalidad</th><th>Cupos</th><th>Estado</th></tr></thead><tbody>`;
        torneos.forEach(t => {
            html += `<tr><td>#${t.id}</td><td>${t.nombre}</td><td>${t.modalidad}</td><td>${t.cupos_inscritos} / ${t.cupos_totales}</td><td>${t.estado || 'Activo'}</td></tr>`;
        });
        html += `</tbody></table>`;
        contenedor.innerHTML = html;

    } else if (tipo === 'partidos') {
        tituloSeccion.innerText = '⚽ Partidos Abiertos';
        const partidos = datosDashboardGlobal.partidos;
        if (partidos.length === 0) return contenedor.innerHTML = `<p>No hay partidos abiertos.</p>`;
        
        let html = `<table style="width: 100%; text-align: left;"><thead><tr><th>ID</th><th>Cancha</th><th>Modalidad/Nivel</th><th>Fecha/Hora</th><th>Creador</th><th>Cupos</th></tr></thead><tbody>`;
        partidos.forEach(p => {
            html += `<tr><td>#${p.id}</td><td>${p.nombre_cancha}</td><td>${p.modalidad} (${p.nivel})</td><td>${p.fecha.split('T')[0]} - ${p.hora}</td><td>👤 ${p.creador}</td><td>${p.cupos_disponibles}/${p.cupos_totales}</td></tr>`;
        });
        html += `</tbody></table>`;
        contenedor.innerHTML = html;

    } else if (tipo === 'usuarios') {
        tituloSeccion.innerText = '👥 Usuarios Registrados';
        const usuarios = datosDashboardGlobal.usuarios;
        if (usuarios.length === 0) return contenedor.innerHTML = `<p>No hay usuarios o no tienes permisos.</p>`;
        
        let html = `<table style="width: 100%; text-align: left;"><thead><tr><th>ID</th><th>Nombre</th><th>Correo</th><th>Rol</th></tr></thead><tbody>`;
        usuarios.forEach(u => {
            html += `<tr><td>#${u.id}</td><td>${u.nombre}</td><td>${u.correo}</td><td>${u.rol || 'jugador'}</td></tr>`;
        });
        html += `</tbody></table>`;
        contenedor.innerHTML = html;
    }
}