# AgendaQuest

Agenda escolar con mascota virtual para estudiantes de secundaria, supervisada por el padre o la madre.
Fase 1 de la propuesta: funciona en una sola computadora o celular, sin servidor, con los datos guardados en el navegador.

## Cómo usarla

**Opción rápida:** abrí `dist/agendaquest.html` con doble clic. Es un solo archivo con todo adentro.

**Opción proyecto:** abrí `index.html`. Es la misma app, con el código separado en archivos para leerlo y modificarlo.

**En el celular:** subí la carpeta a un hosting gratuito de sitios estáticos (por ejemplo Netlify, arrastrando la carpeta, o GitHub Pages) y abrí el link en el celular. Desde el menú del navegador se puede agregar a la pantalla de inicio.

> Importante: los datos quedan en **ese navegador de ese dispositivo**. Si tu hijo usa la app en su celular, el panel del padre también hay que abrirlo en ese celular. Sincronizar varios dispositivos es la fase 2. Descargá una copia de seguridad cada tanto desde *Panel del padre → Ajustes*.

## Primer uso

1. Creás un PIN de 4 números para el panel del padre.
2. Creás el perfil de tu hijo (nombre, año, nombre de la mascota).
3. Tu hijo entra a su perfil y carga sus materias.
4. Cada vez que le dan tarea, la anota con el botón **+** (suma 5 monedas y la mascota nace de su huevo con la primera).
5. Cuando la termina, toca el casillero. Queda "esperando aprobación".
6. Vos entrás al panel con el PIN, la aprobás (o la devolvés con una nota) y recién ahí se acreditan las monedas.
7. En *Ajustes* cargás los premios reales que se pueden canjear.

## Reglas del juego

| Acción | Monedas |
| --- | --- |
| Anotar una tarea | +5 |
| Tarea aprobada, hecha a tiempo | +15 |
| Tarea aprobada, hecha tarde | +5 |
| Sesión de estudio de examen aprobada | +10 |
| 5 días seguidos de revisión diaria con el padre | +20 |
| Semana (lunes a domingo) sin tareas vencidas | +30 |
| Pomodoro completo | +1 cada 5 minutos de foco (15 min = 3, 30 min = 6), hasta 30 por día |
| Tarea borrada | se descuentan las 5 de anotarla |
| Comida diaria de la mascota | −5 |

Los valores están en `js/rules.js` (`MONEDAS`) y se cambian en un solo lugar.

**Mascota:** nace de un huevo con la primera tarea y evoluciona con el nivel (bebé 1–3, joven 4–7, adulta 8+; cada nivel son 100 monedas ganadas).

**Vida y comida:** la mascota tiene 5 corazones de vida. Come una vez por día con el botón "Darle de comer" (5 monedas) y cada comida le devuelve 1 corazón. Cada día que termina sin comer (porque el chico no entró o no tenía monedas) pierde 1 corazón. Con 2 o menos está *débil*; con 0 queda sin fuerzas pero no se muere, y comiendo se recupera. El día que nace no cuenta. El padre puede activar el **modo vacaciones** desde su panel para que no pierda vida en feriados largos o vacaciones.

**Estados**, por prioridad: *débil* (poca vida), *triste* (tareas vencidas), *con hambre* (no comió hoy), *preocupada* (algo para hoy o mañana), *panza llena* (todo bien) y *feliz* por unos segundos después de marcar una tarea, comer o terminar un pomodoro. La comida no descuenta experiencia: el nivel solo depende de las monedas ganadas.

**Pomodoro:** antes de empezar se elige la duración del foco (15, 20, 25 o 30 min) y del descanso (5, 10 o 20 min), y opcionalmente la tarea en la que va a trabajar. La cuenta es regresiva y se ve siempre: grande en la pantalla Pomodoro y en una barra fija arriba en todas las demás (también en el título de la pestaña). Al terminar el foco suena un aviso, se acreditan las monedas y arranca el descanso solo; al terminar el descanso espera a que el estudiante toque "Otro pomodoro". Se puede pausar, saltar el descanso o terminar (si se corta un foco a la mitad, no suma). El tiempo se calcula contra la hora de fin, así que es exacto aunque se bloquee la pantalla o se recargue la página. Las monedas del pomodoro no pasan por aprobación del padre (la app no puede verificar que estudió); por eso tienen tope diario y el panel del padre muestra pomodoros y minutos de hoy y de la semana.

**Exámenes:** al agendar uno, la app reparte hasta 4 sesiones de estudio en los 5 días previos (repaso, práctica, autoevaluación, repaso de errores). Se basa en la evidencia sobre práctica distribuida y autoevaluación (Dunlosky y otros, 2013).

## Estructura del código

```
index.html              carga los scripts en orden
css/styles.css          estilos
js/util.js              fechas (texto AAAA-MM-DD local), ids, escape de HTML, hash del PIN
js/repository.js        patrón Repository: LocalStorageRepository y MemoryRepository
js/rules.js             reglas: monedas, niveles, cosméticos, estado de la mascota, PlanEspaciado (Strategy)
js/store.js             el modelo: todas las operaciones sobre los datos; avisa cambios (Observer)
js/pet.js               dibuja la mascota en pixel art (SVG)
js/pomodoro.js          Temporizador (lógica del pomodoro, con reloj inyectable para pruebas) y Sonido
js/ui.js                piezas de interfaz reutilizables
js/views-estudiante.js  pantallas del estudiante
js/views-padre.js       PIN, panel del padre y ajustes
js/views-pomodoro.js    pantalla del pomodoro
js/app.js               controlador: navegación, eventos y arranque
tests/logica.test.js    pruebas de la lógica:   node tests/logica.test.js
tests/e2e.py            prueba en navegador:     python3 tests/e2e.py  (necesita Playwright)
build.py                genera dist/ con la versión de un solo archivo
```

Patrones usados: **Repository** (cambiar dónde se guardan los datos sin tocar el resto), **Observer** (el Store avisa y la pantalla se redibuja), **Strategy** (el plan de estudio es una clase reemplazable).

### Pasar a la fase 2 (varios dispositivos)

Escribir una clase nueva que extienda `Repositorio` con `cargar()` y `guardar(estado)` contra una base en la nube (por ejemplo Supabase o Firebase; verificar sus planes gratuitos actuales) y cambiar la línea marcada en `js/app.js`. Para que sea realmente multiusuario conviene además que el guardado sea por operación y no del estado completo; eso implica más cambios en `store.js`.

## Limitaciones conocidas

- El PIN es un candado para chicos, no seguridad real: alguien que sepa usar las herramientas del navegador puede cambiar los datos.
- El almacenamiento del navegador tiene un límite (normalmente unos 5 MB). Las fotos se achican, pero conviene borrar las de tareas aprobadas desde *Ajustes*.
- El sonido del pomodoro suena si la app está abierta. Con la pantalla bloqueada, muchos celulares frenan la página y el aviso llega al volver a abrirla (el tiempo igual se cuenta bien). La app pide que la pantalla no se apague durante el pomodoro, si el navegador lo permite.
- No hay notificaciones: la app avisa al abrirla. Por eso la revisión diaria con el padre es parte del sistema.
- Las fuentes se descargan de Google Fonts; sin internet se usan fuentes del sistema y todo lo demás funciona igual.
