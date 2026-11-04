# Correos: reserva confirmada, recuperación de contraseña y confirmación de cuenta

Fecha: 2026-11-04

## Objetivo

Un usuario real, con cualquier dirección de correo, recibe en su bandeja:

1. El enlace para crear una contraseña nueva cuando la olvida.
2. El enlace para confirmar su cuenta al registrarse.
3. Un aviso cuando la sede aprueba su pago y la reserva queda confirmada.

Un fallo de envío nunca bloquea ni deshace una reserva.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Remitente | Una cuenta de Gmail con clave de aplicación |
| Avisos de reserva | Solo "reserva confirmada", al jugador |
| Registro | Las cuentas nuevas confirman su correo antes de entrar |
| Envío del aviso | Cola en la base de datos, con reintentos |
| Reservas creadas por un administrador | No generan correo |

## Fuera de alcance

- Avisos de rechazo, vencimiento, cancelación y recordatorios.
- Avisos a la sede.
- Dominio propio. Cambiar de Gmail a otro proveedor más adelante solo afecta la
  configuración de Auth y el módulo de envío.
- Cambiar la contraseña con la sesión iniciada.
- Las Edge Functions `recuperar-por-telefono` y `recuperar-por-whatsapp`, que
  siguen desplegadas sin estar en el repo. Se revisan en un trabajo aparte.

## Estado actual

- El flujo de recuperación ya está en `Login.jsx`, `NuevaClave.jsx`, `useSesion.js`
  y `datos.js`. No se rediseña.
- El correo por defecto de Supabase solo entrega a miembros del equipo del proyecto.
  No se ha comprobado en el panel si es el que está activo.
- Las 30 cuentas existentes ya figuran con el correo confirmado, así que activar la
  confirmación no las bloquea. Algunas direcciones parecen de prueba y pueden rebotar.
- `pg_cron` y Vault están activos. `pg_net` está disponible, pero sin activar.
- Hay 4 reservas en estado `pendiente`. Si se aprueban después del despliegue,
  recibirán el aviso, que es lo esperado.

## Parte 1: Configuración de Supabase Auth

Se hace en el panel de Supabase, **en este orden**. Si la confirmación se activara
antes que el SMTP, los registros nuevos quedarían sin poder entrar.

1. **SMTP propio:** `smtp.gmail.com`, puerto 465, la cuenta de Gmail como usuario, la
   clave de aplicación como contraseña y "Arma Tu Cancha" como nombre del remitente.
2. **URL:** Site URL `https://santi123pro.github.io/Arma-Tu-Cancha/`. En Redirect URLs,
   `https://santi123pro.github.io/Arma-Tu-Cancha/**` y la dirección local de desarrollo.
3. **Plantillas en español:** "Confirm signup" y "Reset password". Se guardan en
   `supabase/templates/confirmar.html` y `supabase/templates/recuperar.html`, y se
   pegan en el panel.
4. **Probar la recuperación** con un correo que no sea del equipo del proyecto.
5. **Activar "Confirm email".**

El límite de 30 correos por hora que Supabase aplica al usar SMTP propio se deja como
está y solo se sube si hace falta.

## Parte 2: Cambios en la app

- **`Login.jsx`, registro:** `signUp` envía `emailRedirectTo` con la URL base de la app.
  La pantalla `Gracias.jsx` ya cubre el caso de cuenta pendiente.
- **`Login.jsx`, inicio de sesión:** si el error es `Email not confirmed`, se muestra un
  botón "Reenviar correo de confirmación" que usa `supabase.auth.resend`. Sin él, quien
  pierda el enlace o lo deje vencer queda sin salida.
- **`datos.js`:** nueva función `reenviarConfirmacion(correo)`.
- **`frontend/demo/supabaseDemo.js`:** se agrega `resend` a la simulación.
- **`Legal.jsx` y `sitio.js`:** Google se agrega a los proveedores técnicos porque
  procesa los correos, y se actualiza `ACTUALIZACION_LEGAL`.

## Parte 3: Aviso de reserva confirmada

### Flujo

```
revisar_pago aprueba
  -> trigger en reservas (pendiente -> confirmada)
  -> fila en correos_reserva
  -> pg_cron, cada minuto, solo si hay filas listas
  -> Edge Function enviar-correos-reserva
  -> Gmail (puerto 465)
  -> fila marcada como enviada, o reintento programado
```

### Migración `0022_correo_reserva_confirmada.sql`

**Tabla `correos_reserva`**

| Columna | Uso |
|---|---|
| `id` | Clave primaria |
| `reserva_id` | Referencia a la reserva, `unique`, para no duplicar avisos |
| `estado` | `pendiente`, `enviando`, `enviado`, `fallido` u `omitido` |
| `intentos` | Intentos realizados |
| `proximo_intento_at` | Cuándo puede volver a tomarse |
| `ultimo_error` | Último error, sin direcciones de correo |
| `creado_at`, `enviado_at` | Fechas |

Tiene RLS activado, sin políticas, y sin permisos para `anon` ni `authenticated`.

**Trigger `AFTER UPDATE OF estado ON reservas`:** se activa solo si el estado pasa de
`pendiente` a `confirmada`. Hace `insert ... on conflict do nothing`. Cualquier error
interno se captura y se registra como advertencia, para que nunca impida aprobar el pago.

Como solo escucha ese cambio, no genera correos para reservas antiguas ni para las que
un administrador crea ya confirmadas.

**Función `tomar_correos_reserva(p_limite int)`**, solo para `service_role`:

- Toma filas `pendiente` vencidas y filas `enviando` abandonadas hace más de 5 minutos,
  con `for update skip locked`, para que dos ejecuciones no tomen la misma fila.
- Las marca como `enviando` y suma un intento.
- Marca como `fallido` la que ya agotó los 5 intentos.
- Marca como `omitido` la que ya no esté `confirmada` o cuya cuenta no tenga correo.
- Devuelve los datos del correo: código, sede, cancha, fecha, hora de inicio y fin,
  valor, nombre y destinatario.

**Destinatario:** el correo de la cuenta en `auth.users`, según `usuario_id`, y no
`reservas.cliente_correo`. Ese campo lo puede escribir quien llama a `crear_reserva`,
así que no sirve para decidir a quién se le envía un correo.

**Tarea de `pg_cron` `enviar-correos-reserva`:** corre cada minuto y solo llama a la
función con `net.http_post` si hay filas listas. Lee la URL y el token desde Vault.

La migración también activa `pg_net`. Los secretos de Vault se crean aparte y nunca
se guardan en el repo.

### Edge Function `enviar-correos-reserva`

- Se despliega sin verificación de JWT y exige el encabezado `x-correos-token`, que se
  compara en tiempo constante con el secreto `CORREOS_TOKEN`. Sin token válido responde 401.
- Toma hasta 10 correos por ejecución y los envía uno por uno con `npm:nodemailer` por
  el puerto 465, porque Supabase bloquea el 25 y el 587.
- Si el envío funciona, marca `enviado` y guarda `enviado_at`.
- Si falla, vuelve a `pendiente` y espera 1, 5, 15 y 60 minutos según el intento.
- Los registros incluyen el id de la reserva, nunca la dirección de correo.
- Secretos: `GMAIL_USUARIO`, `GMAIL_CLAVE_APP`, `CORREOS_TOKEN` y `APP_URL`.

La plantilla va en `plantilla.ts`, separada del envío. Incluye versión HTML y de texto,
y escapa todos los datos variables.

### Contenido del correo

- **Asunto:** `Reserva confirmada: {sede}, {fecha}`
- **Cuerpo:** saludo con el nombre, código, sede, cancha, fecha, horario y valor en pesos
  colombianos, con un botón a `{APP_URL}/mis-reservas`.

## Diseño de los correos

Los tres correos comparten la misma estructura, tomada de la página:

- **Encabezado:** fondo `#0f172a` con el logo centrado, a 168 px de ancho, y una franja verde `#16a34a`.
- **Logo:** `frontend/public/icono-correo.png`, recortado de `icono-512.png` a 336 px de ancho
  y servido desde la URL pública de la app. Si el cliente bloquea imágenes, el texto
  alternativo "Arma Tu Cancha" se ve en blanco sobre el encabezado.
- **Cuerpo:** tarjeta blanca de máximo 600 px sobre `#f1f5f9`. Títulos en Barlow Condensed y
  texto en Barlow, con Arial como respaldo, porque muchos clientes no cargan fuentes externas.
- **Botón:** verde `#16a34a` con texto blanco. Es el color de la página al pasar el cursor,
  elegido porque el verde normal tiene poco contraste con texto blanco.
- **Pie:** fondo `#0f172a` con el nombre, la ciudad y el teléfono de `sitio.js`.
- **Técnica:** tablas y estilos en línea, para que se vea bien en Gmail y Outlook.

La reserva confirmada muestra el código en un bloque verde, los datos de la reserva con la
fecha completa (`Sábado 7 de noviembre`) y la nota de que se puede cancelar hasta 24 horas antes.

## Limitaciones aceptadas

- **Posible duplicado:** si la función se cae justo después de enviar y antes de marcar
  `enviado`, el reintento repite el correo. Es preferible a que el jugador no lo reciba.
- **Demora:** el aviso puede tardar hasta un minuto o algo más, según la cola.
- **Límite de Gmail:** Auth y los avisos comparten el límite diario de la cuenta, que debe
  comprobarse en la documentación de Google. Al superarlo, los avisos se reintentan y los
  correos de Auth pueden fallar. Si el volumen crece, habrá que migrar a un proveedor con
  dominio propio.
- **Entrega:** Gmail no garantiza llegar a la bandeja de entrada, por eso las pantallas
  ya recuerdan revisar el correo no deseado.
- **Otros estados sin aviso:** quien tenga la reserva rechazada, vencida o cancelada no
  recibe correo y lo ve solo en la app. La sede tampoco recibe correo por comprobantes
  nuevos y los sigue viendo en su panel.

## Verificación

El frontend no tiene pruebas automatizadas, y este trabajo no agrega un framework.

**Código:** ESLint sobre los archivos tocados y `npm run build` en `frontend`.

**Producción, con cuentas de prueba:**

1. Recuperación con un correo que no sea del equipo: llega el mensaje en español, el
   enlace abre `NuevaClave` y la clave nueva sirve para entrar.
2. Registro: llega la confirmación, no se puede entrar antes de confirmar, y el botón
   de reenvío funciona.
3. Reserva aprobada: llega un solo correo con datos correctos y la fila queda `enviado`.
4. Reserva rechazada y reserva vencida: no se envía correo.
5. Reserva creada por un administrador: no se envía correo.
6. Clave de Gmail incorrecta a propósito: la aprobación funciona, la fila reintenta y
   queda `fallido` tras 5 intentos.
7. Llamada a la función sin token: responde 401 y no envía nada.
8. Un usuario autenticado no puede leer `correos_reserva` ni ejecutar
   `tomar_correos_reserva`.

## Despliegue

Cada cambio en producción se confirma aparte antes de ejecutarlo:

1. Publicación del frontend, porque las plantillas cargan el logo desde la URL pública.
2. Configuración de Auth de la Parte 1, sin activar aún "Confirm email". La hace el
   usuario, o se hace con su acompañamiento, porque requiere la clave de aplicación.
3. Secretos de la Edge Function y de Vault.
4. Despliegue de la Edge Function.
5. Migración `0022`.
6. Activación de "Confirm email", una vez probada la recuperación.
