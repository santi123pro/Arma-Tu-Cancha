# Prompt para Claude Code — Pantalla "Arma tu Partido"

---

## Contexto del proyecto

Estoy migrando "Arma Tu Cancha" (proyecto de grado, plataforma de reserva de
canchas sintéticas de fútbol en Cali) de Express + PostgreSQL local a
**Supabase + React (Vite)**. El backend de Express ya no existe: el frontend
habla directo con Supabase vía PostgREST, y la seguridad la da el RLS de las
tablas, no un middleware.

Estructura del proyecto:

```
frontend/
  src/
    style.css                  ← sistema de diseño, NO lo reescribas
    lib/
      supabase.js              ← exporta { supabase, traducirError }
      useSesion.js             ← hook: { usuario, perfil, cargando, esAdmin, autenticado }
    componentes/
      Toast.jsx                ← exporta ToastProvider y useToast()
      MapaSedes.jsx
    paginas/
      Portada.jsx
      Auth.jsx
      Marketplace.jsx
      Sede.jsx                 ← la vista de una sede (aquí va el cambio)
```

**No uso react-router.** La navegación es por estado en `App.jsx`. Los
componentes reciben callbacks (`onVerSede`, etc.) como props.

Los toasts se usan así:

```js
const toast = useToast()
toast('Mensaje', 'exito')   // o 'error'
```

Los errores de Supabase se traducen con `traducirError(error)` antes de
mostrarlos.

---

## Esquema real en Supabase (verificado, no lo asumas distinto)

### `partidos_abiertos`

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| `id` | bigint | NO | identidad |
| `creador_id` | uuid | **NO** | — (FK a `auth.users`) |
| `cancha_id` | bigint | NO | — (FK a `canchas`) |
| `reserva_id` | bigint | SÍ | null |
| `fecha` | date | NO | — |
| `hora_inicio` | time | NO | — |
| `modalidad` | varchar | NO | `'Fútbol 6'` |
| `nivel` | varchar | NO | `'todos'` |
| `posicion_requerida` | varchar | SÍ | null |
| `cupos_totales` | integer | NO | — |
| `cupos_ocupados` | integer | NO | `0` |
| `cupos_disponibles` | integer | — | **columna generada** = `cupos_totales - cupos_ocupados` |
| `estado` | varchar | NO | `'abierto'` |
| `creado_at` | timestamptz | NO | `now()` |

**No existen** `hora_fin` ni `notas`. No los pongas en el formulario.

CHECKs activos:

- `nivel` solo acepta: `'principiante'`, `'intermedio'`, `'avanzado'`, `'todos'`
- `estado` solo acepta: `'abierto'`, `'completo'`, `'cancelado'`, `'jugado'`
- `cupos_totales > 0`
- `cupos_ocupados >= 0 AND cupos_ocupados <= cupos_totales`
- `modalidad` y `posicion_requerida` son texto libre (sin CHECK)

### `partido_jugadores`

Una fila por jugador anotado. Tiene `UNIQUE (partido_id, usuario_id)`.
Un trigger (`fn_sync_cupos_partido`) actualiza `cupos_ocupados` en
`partidos_abiertos` cada vez que se inserta o borra aquí.

### `canchas` y `sedes`

`canchas` tiene `id`, `nombre`, `tipo`, `precio_hora`, `sede_id`, `activa`.
`sedes` tiene `id`, `slug`, `nombre`, `direccion`, `activa`.

---

## Reglas que NO se pueden romper

1. **`creador_id` es obligatorio y hay que mandarlo.** Sácalo de la sesión
   (`useSesion` o `supabase.auth.getUser()`), nunca de un campo del formulario.
2. **Nunca escribas `cupos_ocupados` ni `cupos_disponibles`.** El primero lo
   mantiene el trigger; el segundo es columna generada y PostgreSQL rechaza
   cualquier escritura.
3. **`cancha_id` es bigint.** El `value` de un `<select>` es string: conviértelo
   con `Number(e.target.value)` o el insert falla por tipo.
4. **`posicion_requerida` vacío se manda como `null`**, no como `''`:
   `posicion_requerida: posicion || null`.
5. **`nivel` se manda en minúscula exacta** según el CHECK de arriba.
6. Para listar partidos con cupo usa `.gt('cupos_disponibles', 0)`. No intentes
   comparar `cupos_ocupados` con `cupos_totales` en el filtro: PostgREST no
   compara dos columnas entre sí.

---

## Lo que quiero que construyas

### 1. Cambios en `Sede.jsx` (la vista que se abre al entrar a una sede)

- El enlace **"← Volver a los complejos"** debe quedar pegado a la izquierda
  del contenedor, no centrado.
- A la derecha de esa misma fila, agrega un botón que diga **"Partidos"**.
- Al hacer clic en "Partidos", se despliega debajo la sección "Arma tu Partido".
  Es un toggle: si ya está abierta, se cierra. Maneja esto con `useState`, sin
  cambiar de vista ni de URL.

### 2. Componente nuevo: `src/paginas/Partidos.jsx`

Recibe como prop el `sedeId` (y opcionalmente el nombre de la sede). Tiene dos
bloques, uno debajo del otro.

#### Bloque A — "Arma tu Partido"

Título `<h2>` "Arma tu Partido" y subtítulo "Publicar Partido Abierto".

Formulario en **rejilla de dos columnas** (que colapse a una sola en móvil),
en este orden y con estos campos:

| Fila | Izquierda | Derecha |
|---|---|---|
| 1 | **Cancha** (ocupa las dos columnas) | — |
| 2 | Fecha del partido | Hora de inicio |
| 3 | Modalidad | Nivel requerido |
| 4 | Buscando (posición) | Cupos totales |

Debajo, el botón **"Publicar Partido Ahora"** ocupando todo el ancho.

Detalles de cada campo:

- **Cancha**: `<select>` cargado desde Supabase con
  `.from('canchas').select('id, nombre').eq('sede_id', sedeId).eq('activa', true).order('nombre')`.
  El `value` de cada opción es el `id`, lo que se muestra es el `nombre`.
  Primera opción vacía: "Selecciona la cancha". **No es un campo de texto para
  escribir el ID** — el wireframe lo muestra así pero quiero el desplegable.
  Recarga la lista cuando cambie `sedeId` y limpia la cancha seleccionada.
- **Fecha**: `<input type="date">`, con `min` = hoy (no se publican partidos en
  el pasado).
- **Hora**: `<input type="time">`.
- **Modalidad**: `<select>` con estos valores exactos (respeta tilde,
  mayúscula y espacio): `Fútbol 5`, `Fútbol 6`, `Fútbol 7`, `Fútbol 8`,
  `Fútbol 11`. Por defecto `Fútbol 6`.
- **Nivel requerido**: `<select>` con `value` en minúscula y etiqueta legible:
  `todos` → "Todos los niveles", `principiante` → "Principiante",
  `intermedio` → "Intermedio", `avanzado` → "Avanzado". Por defecto `todos`.
- **Buscando**: `<select>` con opción vacía "Cualquier posición" (manda `null`),
  más `Arquero`, `Defensa`, `Mediocampista`, `Delantero`.
- **Cupos totales**: `<input type="number">` con `min={1}` y `max={22}`.

Comportamiento del botón: se deshabilita mientras la petición está en curso
(para que no se publiquen partidos duplicados si alguien hace doble clic),
muestra "Publicando..." mientras tanto, y al terminar lanza un toast, limpia el
formulario y refresca la lista de abajo.

Si el usuario no ha iniciado sesión, en vez del formulario muestra un aviso
que diga que necesita entrar para publicar un partido.

#### Bloque B — "Partidos buscando jugadores"

Título `<h2>` "Partidos buscando jugadores" y debajo una rejilla de tarjetas
(tres por fila en escritorio, una en móvil), como en el wireframe.

La consulta:

```js
const hoy = new Date().toISOString().slice(0, 10)

await supabase
  .from('partidos_abiertos')
  .select(`
    id, fecha, hora_inicio, modalidad, nivel, posicion_requerida,
    cupos_totales, cupos_ocupados, cupos_disponibles,
    canchas ( nombre, sedes ( nombre, slug ) )
  `)
  .eq('estado', 'abierto')
  .gte('fecha', hoy)
  .gt('cupos_disponibles', 0)
  .order('fecha')
  .order('hora_inicio')
```

Filtra por la sede actual cuando venga `sedeId`.

Cada tarjeta muestra: nombre de la cancha, fecha y hora en formato legible en
español, la modalidad, el nivel, la posición que buscan (si es `null`, escribe
"Cualquier posición"), y de forma destacada cuántos cupos faltan
(`cupos_disponibles` de `cupos_totales`).

Abajo de cada tarjeta, un botón **"Unirse al partido"**.

**Por ahora el botón no tiene que guardar nada en Supabase** — déjalo
preparado, con su `onClick` llamando a una función `unirseAlPartido(id)` que
por el momento solo muestre un toast. La lógica de `partido_jugadores` la
conectamos en el siguiente paso.

Maneja los tres estados de la lista de forma explícita, no dejes el contenedor
en blanco: cargando, error y vacío ("Ahora mismo no hay partidos buscando
jugadores").

---

## Estilos

**Usa las clases que ya existen en `style.css`.** No escribas estilos inline
salvo para detalles puntuales de layout, y no inventes clases nuevas si ya hay
una que sirve. Las disponibles:

- Inputs y selects: `.input-moderno`
- Botones: `.btn-cta-primary` (verde, acción principal),
  `.btn-cta-secondary` (outline, sobre fondo oscuro), `.btn-cta-outline`
- Secciones: `.seccion-landing-light`, `.seccion-landing-dark`
- Encabezado de sección: `.landing-header-flex`, `.sub-tag`, `.landing-title`,
  `.landing-desc-side`
- Rejilla de tarjetas: `.grid-canchas` con `.tarjeta-cancha`
- Tarjetas de landing: `.landing-grid-3`, `.landing-card`, `.card-num`
- Pestañas: `.nav-tabs`, `.tab-btn`, `.tab-btn.active`

Las variables de color están en `:root`: `--navy`, `--green`, `--sky`,
`--amber`, `--red`, `--gray-*`, `--radius`, `--shadow`.

Si necesitas alguna clase nueva, agrégala **al final de `style.css`** siguiendo
la convención de las que ya están, y usando las variables existentes.

---

## Advertencia sobre el JSX

He tenido problemas de etiquetas rotas al copiar código entre herramientas.
Escribe los archivos directamente en disco y, antes de darme por terminado,
verifica que compilan:

```bash
cd frontend && npm run build
```

Si algo falla, arréglalo antes de responderme.
