# Correos de reserva y recuperación: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un usuario real reciba por Gmail la recuperación de contraseña, la confirmación de cuenta y el aviso de reserva confirmada.

**Architecture:** Supabase Auth envía sus correos por SMTP de Gmail. Un trigger guarda cada reserva confirmada en una cola; `pg_cron` llama a una Edge Function que envía por el puerto 465 y reintenta.

**Tech Stack:** PostgreSQL (`pg_cron`, `pg_net`, Vault), Edge Functions en Deno con `npm:nodemailer@6`, React con Vite. Pruebas de módulos con `node --test` (Node 24 ejecuta TypeScript directamente).

**Spec:** `docs/superpowers/specs/2026-11-04-correos-reserva-y-recuperacion-design.md`

## Global Constraints

- **Commits:** ninguna tarea hace commit. Hay un solo commit al final, después de preguntarle al usuario.
- **Producción:** nada se aplica a producción fuera de la Tarea 5, y cada paso allí requiere un sí explícito del usuario para ese paso.
- **Secretos:** la clave de Gmail y los tokens nunca se escriben en el repo ni en el chat.
- **Remitente:** nombre "Arma Tu Cancha". SMTP `smtp.gmail.com`, puerto 465.
- **Reintentos:** máximo 5 intentos, con esperas de 1, 5, 15 y 60 minutos. Lote de 10 correos.
- **Privacidad:** los registros y `ultimo_error` nunca incluyen direcciones de correo.
- **Antes del commit:** ESLint solo sobre los archivos tocados y `npm run build` en `frontend`.
- **Idioma:** textos, nombres y comentarios en español, como el resto del proyecto.
- **Diseño de correos:** sección "Diseño de los correos" de la spec. Los tres correos usan la misma estructura aprobada en la vista previa.
- **Logo:** `{APP_URL}/icono-correo.png`. Debe estar publicado antes de pegar las plantillas de Auth o de enviar correos.

## Review Focus

1. Reserva aprobada y cancelada antes de que corra el envío: no se envía correo y queda `omitido`.
2. Cuenta eliminada (`usuario_id` nulo): queda `omitido`, sin error y sin reintentos.
3. Fecha enviada desde un servidor en UTC: `2026-11-04` se muestra como 4 de noviembre, no como el 3.
4. Nombre del jugador o de la sede con `<`, `&` o comillas: se ve como texto, sin alterar el HTML.
5. Un correo falla a mitad de lote: los demás se envían igual.

---

### Task 1: Cola en la base de datos

**Files:**
- Create: `supabase/migrations/0022_correo_reserva_confirmada.sql`
- Create: `supabase/pruebas/0022_correos.sql`

**Interfaces:**
- Produces, solo para `service_role`:
  - `tomar_correos_reserva(p_limite int default 10)` devuelve filas `(id bigint, reserva_id bigint, destinatario text, nombre text, codigo text, sede text, cancha text, fecha date, hora_inicio time, hora_fin time, precio_total int)`.
  - `marcar_correo_reserva(p_id bigint, p_exito boolean, p_error text default null)` devuelve `void`.
- Produces, secretos de Vault que lee el cron: `correos_funcion_url` y `correos_funcion_token`.

- [ ] **Step 1: Escribir la prueba SQL**

`supabase/pruebas/0022_correos.sql` empieza con `begin;`, termina con `rollback;` y usa `do $$ ... assert ... $$`. Crea sus propias reservas de prueba en una fecha lejana, con una cancha y un usuario existentes. Afirma:

- `pendiente` a `confirmada` crea una sola fila `pendiente`; repetir el cambio no crea otra.
- Insertar una reserva ya `confirmada` no crea fila.
- `pendiente` a `cancelada` no crea fila.
- `tomar_correos_reserva` devuelve la fila con `destinatario` igual a `auth.users.email`, aunque `cliente_correo` sea otra dirección, y la deja `enviando` con `intentos = 1`.
- Una segunda llamada no devuelve la misma fila.
- Reserva cancelada antes de tomarla: no se devuelve y queda `omitido`.
- `usuario_id` nulo: no se devuelve y queda `omitido`.
- `marcar_correo_reserva(id, false, 'x')` con `intentos` 1, 2, 3 y 4 deja `pendiente` y `proximo_intento_at` a 1, 5, 15 y 60 minutos, con margen de un minuto.
- Con `intentos = 5` deja `fallido`.
- `marcar_correo_reserva(id, true)` deja `enviado` con `enviado_at`.
- Fila `enviando` con `bloqueado_hasta` vencido se vuelve a tomar.
- Fila `enviando` vencida con `intentos = 5` queda `fallido`.
- `has_function_privilege('authenticated', ...)` es falso para las dos funciones, y `has_table_privilege('authenticated', 'public.correos_reserva', 'select')` es falso.

- [ ] **Step 2: Escribir la migración**

- `create extension if not exists pg_net;`
- Tabla `correos_reserva` con las columnas de la spec, más `bloqueado_hasta timestamptz`. `reserva_id` lleva `unique` y `on delete cascade`. `check` sobre los cinco estados. Índice parcial sobre `(proximo_intento_at)` para `estado in ('pendiente','enviando')`.
- `enable row level security`, sin políticas, y `revoke all` para `public, anon, authenticated`.
- Función de trigger `fn_encolar_correo_reserva()` con `security definer`, `set search_path = public` y `exception when others then raise warning`, para no bloquear la aprobación. La advertencia incluye solo el id de la reserva.
- Trigger `after update of estado on reservas`, `when (old.estado = 'pendiente' and new.estado = 'confirmada')`.
- `tomar_correos_reserva`: primero marca `fallido` y `omitido`; luego toma con `for update skip locked`, suma un intento, pone `estado = 'enviando'` y `bloqueado_hasta = now() + interval '5 minutes'`. `destinatario` sale de `auth.users.email`.
- `marcar_correo_reserva`: guarda `left(p_error, 300)`. Las esperas son una lista fija indexada por `intentos`.
- `disparar_correos_reserva()`: si no hay filas listas, termina. Si falta un secreto de Vault, lanza una advertencia y termina. Si no, llama a `net.http_post` con el encabezado `x-correos-token`.
- `cron.unschedule` si ya existe y `cron.schedule('enviar-correos-reserva', '* * * * *', ...)`, igual que en `0015`.
- `revoke execute ... from public, anon, authenticated` en todas las funciones nuevas, `grant execute` a `service_role` en `tomar_` y `marcar_`.
- Encabezado de comentarios como en `0021`.

- [ ] **Step 3: Revisar sin aplicar**

La prueba se ejecuta contra producción en la Tarea 5, porque no hay base local. Comprobar: `grep -n "service_role\|revoke" supabase/migrations/0022_correo_reserva_confirmada.sql`.
Expected: cada función nueva aparece en un `revoke`.

---

### Task 2: Edge Function de envío

**Files:**
- Create: `supabase/functions/enviar-correos-reserva/plantilla.ts`
- Create: `supabase/functions/enviar-correos-reserva/lote.ts`
- Create: `supabase/functions/enviar-correos-reserva/index.ts`
- Test: `supabase/functions/enviar-correos-reserva/plantilla.test.ts`
- Test: `supabase/functions/enviar-correos-reserva/lote.test.ts`

**Interfaces:**
- Consumes: las funciones SQL de la Tarea 1, por `admin.rpc`.
- Produces:
  - `type DatosCorreo = { id, reserva_id, destinatario, nombre, codigo, sede, cancha, fecha, hora_inicio, hora_fin, precio_total }`, con los tipos de la Tarea 1 y fechas y horas como `string`.
  - `armarCorreo(d: DatosCorreo, appUrl: string): { asunto: string; html: string; texto: string }`
  - `procesarLote(correos: DatosCorreo[], enviar: (c: DatosCorreo) => Promise<void>, marcar: (id: number, exito: boolean, error?: string) => Promise<void>): Promise<{ enviados: number; fallidos: number }>`
  - `tokenValido(recibido: string | null, esperado: string): boolean`

- [ ] **Step 1: Escribir las pruebas de la plantilla**

Con `node:test` y `node:assert`, datos `fecha: '2026-11-04'`, `hora_inicio: '19:00:00'`, `hora_fin: '20:00:00'`, `precio_total: 120000`, `sede: 'Wembley'`:

- `asunto` es `Reserva confirmada: Wembley, 4 de noviembre`.
- `html` y `texto` contienen el código, la cancha, `Miércoles 4 de noviembre`, `7:00 PM`, `8:00 PM` y `$120.000`. El formato se calcula sin depender de `Intl`, para que no varíe entre Node y Deno.
- `html` contiene `{appUrl}/icono-correo.png`, el `alt="Arma Tu Cancha"` y el color `#0f172a` en el encabezado.
- La fecha no cambia con `TZ=UTC` ni con `TZ=America/Bogota`, y también se prueba `2026-01-01`.
- `00:30:00` se muestra como `12:30 AM`.
- `nombre: '<b>Ana & "Luis"</b>'` aparece escapado en `html`, y el crudo no aparece.
- Con `appUrl` terminado o no en `/`, el enlace es `{appUrl}/mis-reservas`, sin doble barra.

- [ ] **Step 2: Escribir las pruebas del lote**

- Tres correos, el segundo falla: `enviar` se llama 3 veces y el resultado es `{ enviados: 2, fallidos: 1 }`.
- `marcar` recibe `true` para el 1 y el 3, y `false` con el mensaje para el 2.
- Un error cuyo mensaje contiene el destinatario llega a `marcar` sin esa dirección, sustituida por `[correo]`.
- Si `marcar` lanza un error, el lote sigue con el siguiente correo.
- `tokenValido('a', 'a')` es verdadero; `tokenValido('a', 'b')`, `tokenValido('ab', 'a')` y `tokenValido(null, 'a')` son falsos, y `tokenValido('', '')` también es falso.

- [ ] **Step 3: Ver que fallan**

Run: `node --test supabase/functions/enviar-correos-reserva/`
Expected: FAIL porque los módulos no existen.

- [ ] **Step 4: Implementar `plantilla.ts` y `lote.ts`**

Sin imports de Deno ni de npm. HTML con tablas y estilos en línea, idéntico a "Reserva confirmada" en la vista previa aprobada. Los imports relativos llevan la extensión `.ts`.

- [ ] **Step 5: Ver que pasan**

Run: `node --test supabase/functions/enviar-correos-reserva/`
Expected: PASS en todas.

- [ ] **Step 6: Implementar `index.ts`**

Sigue el estilo de `entrar-con-telefono/index.ts`. Solo acepta `POST`. Verifica `x-correos-token` con `tokenValido` antes de cualquier otra cosa y responde 401 si no es válido. Lee `GMAIL_USUARIO`, `GMAIL_CLAVE_APP`, `CORREOS_TOKEN` y `APP_URL` de `Deno.env`. Crea el transporte de `npm:nodemailer@6` con `host: 'smtp.gmail.com'`, `port: 465`, `secure: true`. El remitente es `"Arma Tu Cancha" <GMAIL_USUARIO>`. Responde JSON con `{ enviados, fallidos }`, sin CORS, porque no la llama el navegador.

---

### Task 3: Registro y reenvío de confirmación

**Files:**
- Modify: `frontend/src/lib/datos.js`
- Modify: `frontend/src/paginas/Login.jsx`
- Modify: `frontend/demo/supabaseDemo.js`

**Interfaces:**
- Produces:
  - `urlApp(): string` en `datos.js`, que `urlRecuperacion` reutiliza.
  - `reenviarConfirmacion(correo: string): Promise<{ datos: null, error: string | null }>`.

- [ ] **Step 1: Implementar `datos.js`**

`reenviarConfirmacion` usa `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: urlApp() } })`.

- [ ] **Step 2: Implementar `Login.jsx`**

- `signUp` agrega `emailRedirectTo: urlApp()` en `options`.
- `FormEntrar` guarda `sinConfirmar` cuando el error de entrar con correo es `email_not_confirmed`, por `error.code` o por el texto `Email not confirmed`. Se reinicia en cada intento.
- Con `sinConfirmar`, debajo del error aparece el botón `Reenviar correo de confirmación` (clase `login-link`), que se deshabilita mientras envía.
- Al enviar con éxito muestra el toast `Te enviamos otro correo. Revisa también el correo no deseado.`, y si hay error lo muestra traducido.
- Entrar con celular no muestra el botón, porque ahí no se conoce el correo.

- [ ] **Step 3: Implementar `supabaseDemo.js`**

Agregar `resend: async () => ({ data: null, error: SIN_CONEXION })` en `auth`.

- [ ] **Step 4: Verificar**

Run: `cd frontend && npx eslint src/lib/datos.js src/paginas/Login.jsx demo/supabaseDemo.js && npm run build`
Expected: sin errores y build correcto.

---

### Task 4: Plantillas de Auth y política de privacidad

**Files:**
- Create: `supabase/templates/confirmar.html`
- Create: `supabase/templates/recuperar.html`
- Modify: `frontend/src/paginas/Legal.jsx:71`
- Modify: `frontend/src/lib/sitio.js:22`

- [ ] **Step 1: Crear las plantillas**

Mismo HTML y textos de la vista previa aprobada, con el botón apuntando a `{{ .ConfirmationURL }}` y el logo en `https://santi123pro.github.io/Arma-Tu-Cancha/icono-correo.png`. Asuntos, en un comentario al inicio de cada archivo: `Confirma tu cuenta de Arma Tu Cancha` y `Crea tu nueva contraseña de Arma Tu Cancha`.

Crear también `frontend/public/icono-correo.png`: recorte de `icono-512.png` sin el margen del fondo, a 336 px de ancho. El nombre empieza por `icono-` para que lo excluya la regla de `vercel.json`.

- [ ] **Step 2: Actualizar los textos legales**

En `Legal.jsx`, agregar a los proveedores técnicos: `Google (envío de correos de la cuenta y de reservas)`. En `sitio.js`, `ACTUALIZACION_LEGAL` pasa a la fecha en que se publique, con el formato actual, por ejemplo `4 de noviembre de 2026`.

- [ ] **Step 3: Verificar**

Run: `cd frontend && npx eslint src/paginas/Legal.jsx src/lib/sitio.js && npm run build`
Expected: sin errores.

- [ ] **Step 4: Preguntar por el commit**

Mostrar el resumen y preguntar al usuario si hace el commit con la spec, el plan y el código. Con su sí: `git add` de los archivos de las Tareas 1 a 4 y de `docs/superpowers/`, y commit. El push a `upstream` y `origin` publica el frontend, así que se hace en la Tarea 5.

---

### Task 5: Despliegue y verificación en producción

Cada paso se ejecuta solo con un sí del usuario para ese paso. Si un paso falla, se detiene aquí y se informa.

**Files:** ninguno, salvo que una verificación obligue a corregir código.

- [ ] **Step 0: Publicar el frontend**

`git pull --rebase upstream main`, `git push upstream main`, `git push origin main`. Expected: el workflow `desplegar-frontend.yml` termina bien y `https://santi123pro.github.io/Arma-Tu-Cancha/icono-correo.png` responde 200. Va primero porque las plantillas cargan el logo desde esa URL. El botón de reenvío y `emailRedirectTo` no cambian nada mientras la confirmación siga desactivada.

- [ ] **Step 1: Configurar Auth, sin activar la confirmación**

El usuario crea la clave de aplicación y la pega en el panel. Hace los puntos 1, 2 y 3 de la Parte 1 de la spec.

- [ ] **Step 2: Probar la recuperación**

Con un correo que no sea del equipo del proyecto. Expected: llega en español, el enlace abre `NuevaClave` y la clave nueva sirve para entrar. Si no funciona, no se sigue.

- [ ] **Step 3: Crear secretos**

El usuario pone en el panel de Edge Functions `GMAIL_USUARIO`, `GMAIL_CLAVE_APP`, `CORREOS_TOKEN` y `APP_URL` (`https://santi123pro.github.io/Arma-Tu-Cancha`). En Vault crea `correos_funcion_url` y `correos_funcion_token`, este último con el mismo valor de `CORREOS_TOKEN`.

- [ ] **Step 4: Desplegar la Edge Function y probar el acceso**

Desplegar `enviar-correos-reserva` con `verify_jwt: false`, incluyendo `plantilla.ts` y `lote.ts`.
Expected: `POST` sin token responde 401. La prueba con token va en el paso siguiente, porque necesita la migración.

- [ ] **Step 5: Aplicar la migración `0022` y correr la prueba SQL**

Ejecutar `supabase/pruebas/0022_correos.sql`.
Expected: termina sin errores de `assert`, y `select count(*) from correos_reserva` da 0, porque todo se revierte. Luego, `POST` con el token y la cola vacía responde `{ enviados: 0, fallidos: 0 }`. Eso prueba que la función arranca, pero no el envío: el primer envío real por `npm:nodemailer` y el puerto 465 es el paso siguiente.

- [ ] **Step 6: Probar el aviso de punta a punta**

Con una cuenta de prueba, reservar, subir comprobante y aprobar. Expected: en menos de dos minutos llega un solo correo con datos correctos y la fila queda `enviado`. Luego rechazar una reserva y dejar otra vencer: no hay correo. Crear una como administrador: no hay fila.

- [ ] **Step 7: Probar el fallo de Gmail**

Cambiar `GMAIL_CLAVE_APP` por un valor incorrecto y aprobar una reserva. Expected: la aprobación funciona y `intentos` sube con `ultimo_error` sin direcciones. Restaurar la clave: el correo sale en el siguiente reintento. Para no esperar las cinco rondas, el estado `fallido` lo cubre la prueba SQL.

- [ ] **Step 8: Revisar el diseño en clientes reales**

Abrir los tres correos recibidos en Gmail web, Gmail en celular y Outlook o Hotmail. Expected: logo visible, botón legible y sin desbordes a lo ancho. Con las imágenes bloqueadas se lee "Arma Tu Cancha" en el encabezado.

- [ ] **Step 9: Activar "Confirm email" y probar el registro**

Expected: la cuenta nueva no puede entrar antes de confirmar, el botón de reenvío funciona, el enlace abre la app con sesión, y una cuenta existente sigue entrando con correo y con celular. Registrarse con un correo que ya existe muestra `Ya existe una cuenta con ese correo. Inicia sesión.` y no lleva a la pantalla de "Gracias".

- [ ] **Step 10: Limpiar y reportar**

Borrar las cuentas y reservas de prueba, con el visto bueno del usuario. Consultar `get_advisors` de seguridad y reportar los resultados de cada verificación.
