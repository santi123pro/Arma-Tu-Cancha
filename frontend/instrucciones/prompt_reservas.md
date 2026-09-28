PROMPT — APARTADO DE RESERVAS / CANCHAS

Necesito modificar el apartado de “Reservas” de mi página web para que siga visual y funcionalmente el wireframe.

IMPORTANTE:
El backend de reservas YA ESTÁ IMPLEMENTADO EN SUPABASE. NO debes modificar, crear, eliminar ni volver a ejecutar SQL relacionado con reservas.
Todo lo necesario para las reservas ya existe en las migraciones:

0001_esquema.sql
0002_rls.sql
0003_funciones.sql

Lo que necesito ahora es frontend, utilizando correctamente las tablas, RLS y funciones RPC que ya existen.

Antes de modificar código, revisa la arquitectura actual del proyecto, los componentes existentes, el sistema de estilos, la navegación y especialmente cómo está implementado actualmente el apartado de Sedes. Reutiliza la lógica y componentes existentes cuando sea posible.

1. FLUJO GENERAL

El flujo debe ser:

Sedes
   ↓
Usuario hace clic en "Entrar"
   ↓
Se abre el apartado de Reservas de esa sede
   ↓
Se consultan las canchas activas de esa sede
   ↓
Se muestran las canchas en tarjetas como el wireframe
   ↓
Cada cancha muestra sus horarios disponibles/ocupados
   ↓
Usuario puede elegir un día específico
   ↓
Se actualizan las franjas horarias según la fecha seleccionada
   ↓
Usuario selecciona una franja
   ↓
Usuario pulsa "Reservar"
   ↓
Se llama crear_reserva()
   ↓
Se muestra confirmación/código de reserva

El botón “Entrar” de cada sede debe conservar la relación con la sede seleccionada.

Por ejemplo:

Bernabeu → Reservas de Bernabeu
La Bombonera → Reservas de La Bombonera
Wembley → Reservas de Wembley

No quiero que al entrar se mezclen las canchas de todas las sedes.

2. REFERENCIA VISUAL

El diseño debe seguir el wireframe adjunto.

En escritorio quiero una distribución tipo:

┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│                      │ │                      │ │                      │
│  IMAGEN CANCHA       │ │  IMAGEN CANCHA       │ │  IMAGEN CANCHA       │
│                      │ │                      │ │                      │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│ Cancha Principal     │ │ Cancha Sintética 2   │ │ Cancha Sintética 3   │
│ Tipo: Sintética      │ │ Tipo: Sintética      │ │ Tipo: Sintética      │
│ Tarifa: $80.000      │ │ Tarifa: $80.000      │ │ Tarifa: $80.000      │
│                      │ │                      │ │                      │
│ [3 PM] [5 PM] [...]  │ │ [3 PM] [5 PM] [...]  │ │ [3 PM] [5 PM] [...]  │
│                      │ │                      │ │                      │
│ [Elegir día...]      │ │ [Elegir día...]      │ │ [Elegir día...]      │
│                      │ │                      │ │                      │
│ [     Reservar     ] │ │ [     Reservar     ] │ │ [     Reservar     ] │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘

┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ Cancha Sintética 4   │ │ Cancha Sintética 5   │ │ Cancha VIP           │
│ ...                  │ │ ...                  │ │ ...                  │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘

Es decir:

3 tarjetas por fila en escritorio.
Las tarjetas deben tener exactamente la misma estructura.
Las canchas deben venir dinámicamente de Supabase.
No crear las seis canchas manualmente.
Si existen 4, mostrar 4.
Si existen 6, mostrar 6.
Si existen 10, mostrar 10.
El grid debe adaptarse automáticamente.
3. CONSULTAR LAS CANCHAS DE LA SEDE

Para obtener las canchas utiliza la estructura existente:

sedes
  ↓
canchas

La consulta debe utilizar el sede_id de la sede seleccionada.

La lógica base existente es:

const { data } = await supabase
  .from('canchas')
  .select('id, nombre, tipo, precio_hora')
  .eq('sede_id', sedeId)
  .eq('activa', true)

Puedes ampliar el select si la tabla ya tiene otros campos útiles para el diseño, especialmente si existe algún campo de imagen.

No inventes columnas.

Primero revisa la estructura que ya utiliza el proyecto y utiliza únicamente campos reales.

4. TARJETA DE CADA CANCHA

Cada cancha debe convertirse en un componente/tarjeta reutilizable.

Por ejemplo:

CanchaCard

La tarjeta debe contener:

A. IMAGEN

En la parte superior.

Debe ocupar prácticamente todo el ancho de la tarjeta.

Utilizar:

object-fit: cover;

La imagen debe mantener una proporción horizontal similar al wireframe.

IMPORTANTE SOBRE LAS IMÁGENES

Si la tabla de canchas ya tiene un campo de imagen/URL y existe una imagen válida:

utilizar esa imagen.

Si NO existe una imagen en Supabase para la cancha, NO dejar un espacio vacío ni romper la tarjeta.

En ese caso quiero mantener la lógica visual que utilizamos anteriormente en el apartado de Sedes:

utilizar el color asociado a la sede si ya existe;
mostrar el nombre de la sede;
generar una representación visual consistente con el diseño existente.

Es decir:

Si existe imagen:
    mostrar imagen

Si NO existe imagen:
    utilizar fallback visual de la sede
    + color de la sede
    + nombre de la sede

No inventar una URL de imagen externa.

Reutiliza el mecanismo de fallback que ya existe en el apartado de Sedes.

5. INFORMACIÓN DE LA CANCHA

Debajo de la imagen mostrar:

Nombre

Ejemplo:

Cancha Principal

Debe ser el texto más destacado de esta sección.

Tipo

Ejemplo:

Tipo: Sintética

Utilizar el valor real de Supabase.

Tarifa

Ejemplo:

Tarifa: $80.000

Debe utilizar:

precio_hora

y formatearlo correctamente como moneda colombiana.

No escribir $80.000 manualmente.

Si el precio cambia en Supabase, el frontend debe mostrar el nuevo valor.

6. HORARIOS / FRANJAS DISPONIBLES

Debajo de la información de la cancha deben aparecer botones de horario.

Ejemplo del wireframe:

[3:00 PM] [5:00 PM] [7:00 PM] [8:00 PM] [9:00 PM]

Estos horarios NO deben ser hardcodeados.

Deben venir de:

supabase.rpc('disponibilidad_cancha', {
  p_cancha_id: canchaId,
  p_fecha: fechaSeleccionada
})

La función existente:

disponibilidad_cancha(p_cancha_id, p_fecha)

ya devuelve las franjas del día y su estado:

libre
ocupada

Antes de implementar, revisa exactamente qué columnas devuelve la función en el proyecto y adapta el frontend a esa estructura real.

No asumir nombres de campos que no existan.

7. ESTADO VISUAL DE LOS HORARIOS

Cada franja debe indicar claramente si está disponible u ocupada.

Por ejemplo:

Disponible
[ 3:00 PM ]

Debe ser seleccionable.

Ocupada
[ 5:00 PM ]

Debe aparecer visualmente deshabilitada.

Una franja ocupada:

no debe poder seleccionarse;
no debe permitir reservar;
debe tener un estilo visual diferente;
no debe provocar una llamada a crear_reserva.

Una franja disponible:

debe poder seleccionarse;
al seleccionarla debe quedar visualmente marcada;
solamente una franja debe quedar seleccionada por cancha.

Mantener los colores y estilos generales que ya utiliza el proyecto.

8. ELEGIR DÍA ESPECÍFICO

Debajo de los horarios debe existir el botón:

Elegir día específico

Tal como aparece en el wireframe.

Al hacer clic:

mostrar un selector de fecha;
permitir seleccionar una fecha;
actualizar fechaSeleccionada;
volver a consultar:
disponibilidad_cancha(canchaId, fechaSeleccionada)
actualizar los horarios de esa cancha.

No quiero que la página tenga que recargarse completamente para cambiar de fecha.

9. FECHA ACTUAL

Al cargar la pantalla inicialmente, utilizar una fecha válida por defecto para consultar disponibilidad.

Preferiblemente:

fecha actual

pero respetando las reglas que ya tenga implementadas disponibilidad_cancha.

No permitir seleccionar fechas inválidas si el backend ya tiene restricciones para reservas.

Si crear_reserva o las funciones existentes tienen reglas relacionadas con fechas, no duplicar esas reglas en el frontend de forma diferente.

El frontend puede prevenir errores obvios, pero Supabase sigue siendo la autoridad.

10. BOTÓN "RESERVAR"

En el wireframe original faltaba este botón.

Debajo de:

Elegir día específico

agregar:

Reservar

Ejemplo:

┌──────────────────────────────┐
│ [3 PM] [5 PM] [7 PM] [8 PM] │
│                              │
│ [ Elegir día específico ]    │
│                              │
│ [       RESERVAR       ]     │
└──────────────────────────────┘

El botón debe:

utilizar el estilo visual existente;
estar claramente separado del selector de fecha;
estar inicialmente deshabilitado si no existe una franja seleccionada;
habilitarse cuando exista:
una cancha;
una fecha;
una franja disponible seleccionada.
11. CREAR LA RESERVA

Al hacer clic en:

Reservar

utilizar la función RPC existente:

supabase.rpc('crear_reserva', {
  p_cancha_id: canchaId,
  p_fecha: fechaSeleccionada,
  p_hora_inicio: horaInicio,
  p_hora_fin: horaFin
})

No enviar usuario_id.

El usuario autenticado ya es obtenido por el backend mediante:

auth.uid()

No crear una lógica paralela para identificar al usuario.

12. MANEJO DE RESERVA DUPLICADA

La base de datos ya tiene el índice:

reservas_sin_solape

que evita reservas simultáneas para la misma cancha y franja.

Si dos usuarios intentan reservar exactamente la misma franja:

Usuario A → reserva aceptada
Usuario B → PostgreSQL rechaza

El frontend debe manejar correctamente ese error.

Si Supabase devuelve el error correspondiente a una restricción de unicidad, mostrar un mensaje amigable como:

Esta franja acaba de ser reservada por otro usuario. 
Actualiza la disponibilidad e intenta con otro horario.

Después del error:

volver a consultar disponibilidad;
actualizar los botones;
marcar la franja como ocupada.

No intentar resolver la concurrencia haciendo una consulta previa y luego un INSERT manual.

La base de datos ya es la autoridad para esto.

13. CONFIRMACIÓN DE RESERVA

Si:

crear_reserva()

funciona correctamente y devuelve el código de reserva, mostrar una confirmación clara.

Por ejemplo:

¡Reserva realizada!

Cancha:
Cancha Principal

Fecha:
05/10/2026

Horario:
3:00 PM - 4:00 PM

Código de reserva:
ABC12345

Utilizar el código real devuelto por Supabase.

No generar un código en JavaScript.

14. CANCELAR RESERVAS

No implementar aquí una lógica nueva de cancelación.

La función ya existente es:

cancelar_reserva(p_reserva_id)

Si el proyecto ya tiene una sección de "Mis reservas", mantener esa funcionalidad intacta.

No modificarla salvo que sea estrictamente necesario para que el nuevo flujo de creación sea compatible.

15. RLS Y SEGURIDAD

No modificar RLS.

Ya existe una política basada en:

usuario_id = auth.uid()
or
administro_cancha(cancha_id)

El frontend no debe intentar sustituir esa seguridad.

No confiar en:

usuario_id enviado desde el navegador

No crear campos ocultos ni parámetros que permitan seleccionar otro usuario.

16. NAVEGACIÓN DESDE "ENTRAR"

En el apartado de Sedes actualmente existe un botón:

Entrar

Cuando el usuario haga clic en él:

Sede seleccionada
        ↓
Apartado Reservas
        ↓
Mostrar solamente las canchas de esa sede

Por ejemplo:

Entrar en Bernabeu

↓

Reservas

Bernabeu

[Cancha Principal]
[Cancha Sintética 2]
[Cancha Sintética 3]

No mostrar las canchas de otras sedes.

Si la arquitectura actual utiliza:

React Router
Next Router
estado global
props
URL params

o cualquier otro mecanismo, reutilizar el existente.

No crear una segunda arquitectura de navegación.

17. IDENTIDAD VISUAL DE LA SEDE

Quiero mantener la identidad visual que ya implementamos en el apartado de Sedes.

La pantalla de reservas debe dejar claro en qué sede se encuentra el usuario.

Por ejemplo, arriba del listado:

Reservar cancha

Bernabeu

o:

Reservas — Bernabeu

Utilizar el mismo:

color;
nombre;
estilo;
tipografía;
elementos visuales

que ya utiliza la tarjeta de esa sede.

Si la sede tiene un color definido en el proyecto, reutilizarlo.

No crear colores nuevos arbitrariamente.

18. ESTRUCTURA DEL GRID

En escritorio:

grid-template-columns: repeat(3, 1fr);

o equivalente según el framework utilizado.

Las tarjetas deben tener:

misma altura visual;
mismo padding;
mismo espacio;
misma distribución;
imagen con misma proporción;
botones alineados.

Evitar que una tarjeta se vea diferente simplemente porque tiene un nombre más largo o más información.

19. RESPONSIVE
Desktop

Mostrar:

3 columnas

Ejemplo:

┌───────┐ ┌───────┐ ┌───────┐
│Cancha │ │Cancha │ │Cancha │
└───────┘ └───────┘ └───────┘
Tablet

Si el ancho no permite tres columnas:

2 columnas
Mobile

Mostrar:

1 columna

Ejemplo:

┌───────────────┐
│ Cancha        │
│ Imagen        │
│ Información   │
│ Horarios      │
│ Fecha         │
│ Reservar      │
└───────────────┘

┌───────────────┐
│ Cancha        │
│ ...           │
└───────────────┘

No debe existir scroll horizontal.

20. CARGA Y ESTADOS

Implementar correctamente los estados:

Cargando canchas

Mostrar un loading apropiado mientras se consulta:

canchas
Sin canchas

Si Supabase devuelve:

[]

mostrar algo como:

No hay canchas disponibles en esta sede.

No mostrar tarjetas ficticias.

Error

Si falla la consulta:

No fue posible cargar las canchas.
Intenta nuevamente.
Cargando disponibilidad

Cuando se cambia la fecha, no bloquear innecesariamente toda la página.

Mostrar un estado de carga únicamente en las tarjetas o sección correspondiente.

21. EVITAR CONSULTAS INNECESARIAS

No realizar consultas repetidas innecesariamente.

Al cambiar la fecha, actualizar únicamente la disponibilidad necesaria.

Si hay seis canchas, evitar hacer múltiples llamadas idénticas a la misma cancha.

Utilizar correctamente:

cancha_id
fecha

para consultar:

disponibilidad_cancha()

y mantener un estado de disponibilidad por cancha.

22. NO HARDCODEAR DATOS

NO escribir directamente en el código:

Cancha Principal
Cancha Sintética 2
Cancha Sintética 3
Cancha Sintética 4
Cancha Sintética 5
Cancha VIP

Esos nombres son únicamente ejemplos del wireframe.

Deben venir de:

Supabase → canchas

Igualmente:

tipo
precio_hora
imagen

deben utilizar los datos reales disponibles.

23. NO MODIFICAR SUPABASE

Esto es especialmente importante:

NO modificar:

tablas;
columnas;
índices;
RLS;
funciones;
triggers;
constraints;
migraciones;
relaciones.

Las funciones existentes son:

disponibilidad_cancha()
crear_reserva()
cancelar_reserva()

El trabajo solicitado es únicamente integrar correctamente el frontend con lo que ya existe.

24. SI UNA FUNCIÓN TIENE UNA ESTRUCTURA DIFERENTE

No asumir que el resultado de:

disponibilidad_cancha()

tiene exactamente los nombres de campos del ejemplo.

Primero inspecciona cómo está definida actualmente la función y cómo devuelve los datos.

Adapta el frontend a la estructura real.

Lo mismo aplica para:

crear_reserva()

Utiliza exactamente los parámetros y resultado que ya tiene la función.

No cambiar la función para adaptarla al frontend.

25. REUTILIZAR COMPONENTES

Si el proyecto ya tiene componentes como:

Button
Card
Modal
DatePicker
Loading
Alert

reutilizarlos.

No crear componentes duplicados con estilos diferentes.

Idealmente la estructura podría ser conceptualmente:

ReservasPage
│
├── EncabezadoSede
│
└── CanchasGrid
    │
    ├── CanchaCard
    │   ├── ImagenCancha
    │   ├── InformacionCancha
    │   ├── Horarios
    │   ├── SelectorFecha
    │   └── BotonReservar
    │
    ├── CanchaCard
    ├── CanchaCard
    └── ...

Adaptar esto a la arquitectura real del proyecto.

26. OBJETIVO VISUAL FINAL

Quiero que el apartado de reservas se vea como el wireframe adjunto:

                    RESERVAS
              Bernabeu / Sede actual

┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│                   │ │                   │ │                   │
│     IMAGEN        │ │     IMAGEN        │ │     IMAGEN        │
│                   │ │                   │ │                   │
├───────────────────┤ ├───────────────────┤ ├───────────────────┤
│ Cancha Principal  │ │ Cancha Sintética  │ │ Cancha Sintética  │
│ Tipo: Sintética   │ │ Tipo: Sintética   │ │ Tipo: Sintética   │
│ Tarifa: $80.000   │ │ Tarifa: $80.000   │ │ Tarifa: $80.000   │
│                   │ │                   │ │                   │
│ [3 PM][5 PM][7PM] │ │ [3 PM][5 PM][7PM] │ │ [3 PM][5 PM][7PM] │
│                   │ │                   │ │                   │
│ [Elegir día...]   │ │ [Elegir día...]   │ │ [Elegir día...]   │
│                   │ │                   │ │                   │
│ [   RESERVAR   ]  │ │ [   RESERVAR   ]  │ │ [   RESERVAR   ]  │
└───────────────────┘ └───────────────────┘ └───────────────────┘

┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ Cancha 4          │ │ Cancha 5          │ │ Cancha VIP        │
│ ...               │ │ ...               │ │ ...               │
└───────────────────┘ └───────────────────┘ └───────────────────┘

La prioridad es:

Mantener la funcionalidad existente.
Utilizar Supabase tal como ya está implementado.
No modificar el backend.
Mostrar únicamente las canchas de la sede seleccionada.
Obtener dinámicamente las canchas.
Obtener dinámicamente disponibilidad por fecha.
Permitir seleccionar horario.
Permitir seleccionar día específico.
Crear la reserva mediante crear_reserva().
Manejar correctamente concurrencia y errores de reserva.
Mantener el estilo visual existente de la página.
Usar el color/nombre de la sede como fallback cuando no exista imagen.
Hacer el diseño responsive.
No inventar datos ni modificar las funciones SQL existentes.
MUY IMPORTANTE ANTES DE TERMINAR

Después de implementar, revisa que:

El botón Entrar de cada sede lleve a la sede correcta.
Las canchas mostradas correspondan únicamente a esa sede.
Los horarios provengan de disponibilidad_cancha().
Una franja ocupada no pueda seleccionarse.
Una franja disponible pueda seleccionarse.
El botón Reservar permanezca deshabilitado hasta seleccionar una franja.
crear_reserva() reciba los parámetros correctos.
No se envíe usuario_id desde el frontend.
El código de reserva mostrado sea el devuelto por Supabase.
Los errores de concurrencia se manejen correctamente.
Al cambiar de fecha se actualice la disponibilidad.
No se haya modificado ningún SQL, RLS, función o estructura de Supabase.
No se hayan roto las funcionalidades existentes de Sedes.

Primero inspecciona el código actual y reutiliza su arquitectura. Después realiza los cambios necesarios. No reemplaces componentes funcionales existentes sin necesidad