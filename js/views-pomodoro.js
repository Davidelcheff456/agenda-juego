/*
 * views-pomodoro.js — Pantalla del Pomodoro: elegir tiempos, cuenta regresiva y descanso.
 * Los números que cambian cada segundo (#pomo-tiempo, #pomo-anillo) los actualiza
 * App._pintarPomodoro() sin volver a dibujar toda la pantalla.
 */
(function (AQ) {
  'use strict';

  const { util, reglas, ui, pomodoro } = AQ;
  const esc = util.esc;
  const V = AQ.vistas = AQ.vistas || {};

  const RADIO = 108;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

  V.anilloPomodoro = { RADIO, CIRCUNFERENCIA };

  function chips(nombre, opciones, elegido, sufijo) {
    return opciones.map((n) =>
      '<label class="chip-radio chip-tiempo"><input type="radio" name="' + nombre + '" value="' + n + '"' + (n === elegido ? ' checked' : '') + '>' +
      '<span><b>' + n + '</b> ' + sufijo + '</span></label>').join('');
  }

  V.pomodoro = function (app) {
    const s = app.store;
    const T = app.temporizador;
    const p = app.perfil();
    const hoyMonedas = s.monedasPomodoroHoy(p.id);
    const tope = reglas.MONEDAS.TOPE_POMODORO_DIA;
    const estudio = s.estudio(p.id, 1);

    // Un pomodoro de otro perfil sigue corriendo en este dispositivo.
    if (T.activo && T.estado.perfilId !== p.id) {
      const otro = s.perfil(T.estado.perfilId);
      return '<main class="pantalla con-nav">' + ui.encabezado('Pomodoro', null, ui.botonAjustes('pomodoro')) +
        ui.vacio('Hay un pomodoro de ' + esc(otro ? otro.nombre : 'otro perfil') + ' en curso en este dispositivo.',
          '<button type="button" class="boton secundario" data-accion="pomo-terminar">Terminarlo</button>') +
        ui.navEstudiante('pomodoro') + '</main>';
    }

    if (!T.activo) {
      const pref = s.ajustes(p.id);
      const pendientes = s.tareasDe(p.id).filter((t) => t.estado === 'pendiente').sort((a, b) => a.vence.localeCompare(b.vence));
      const opcionesTarea = pendientes.map((t) => {
        const m = s.materia(t.materiaId);
        return '<option value="' + t.id + '">' + esc((m ? m.nombre + ': ' : '') + t.titulo) + '</option>';
      }).join('');
      return '<main class="pantalla con-nav">' + ui.encabezado('Pomodoro', null, ui.botonAjustes('pomodoro')) +
        '<p class="texto-suave">Estudiás sin distraerte un rato fijo y después descansás. Cada pomodoro completo suma monedas.</p>' +
        '<form class="formulario" data-form="pomodoro">' +
        '<fieldset><legend>¿Cuánto dura cada pomodoro?</legend><div class="grilla-tiempos">' + chips('foco', pomodoro.OPCIONES_FOCO, pref.foco, 'min') + '</div></fieldset>' +
        '<fieldset><legend>¿Y cada descanso?</legend><div class="grilla-tiempos tres">' + chips('descanso', pomodoro.OPCIONES_DESCANSO, pref.descanso, 'min') + '</div></fieldset>' +
        (opcionesTarea ? '<label for="tareaId">¿En qué vas a trabajar? (opcional)</label>' +
          '<select id="tareaId" name="tareaId"><option value="">Nada en particular</option>' + opcionesTarea + '</select>' : '') +
        '<div class="aviso-monedas">' + ui.moneda(18) + '<span>Suma <strong>1 moneda cada 5 minutos</strong> de foco (25 min = +5). Hoy llevás ' + hoyMonedas + ' de ' + tope + '.</span></div>' +
        '<button class="boton primario ancho grande" type="submit">' + ui.icono('reloj', 22) + 'Empezar</button>' +
        '</form>' +
        (estudio.pomodoros ? '<p class="texto-chico centro">Hoy: ' + estudio.pomodoros + (estudio.pomodoros === 1 ? ' pomodoro, ' : ' pomodoros, ') + estudio.minutos + ' minutos de foco.</p>' : '') +
        ui.navEstudiante('pomodoro') + '</main>';
    }

    const e = T.estado;
    const fase = e.fase;
    const tarea = e.tareaId ? s.tarea(e.tareaId) : null;
    const restante = T.restante();
    const total = T.total();
    const offset = fase === 'listo' ? 0 : CIRCUNFERENCIA * (1 - restante / total);
    const titulos = { foco: 'A concentrarse', descanso: 'Descanso', listo: '¡Descanso terminado!' };
    const color = fase === 'foco' ? 'var(--lima)' : 'var(--azul)';

    let botones;
    if (fase === 'listo') {
      botones = '<button type="button" class="boton primario ancho grande" data-accion="pomo-otro">Otro pomodoro de ' + e.foco + ' min</button>' +
        '<button type="button" class="boton secundario ancho" data-accion="pomo-terminar">Terminar por hoy</button>';
    } else {
      botones = (T.pausado
        ? '<button type="button" class="boton primario ancho grande" data-accion="pomo-reanudar">Seguir</button>'
        : '<button type="button" class="boton secundario ancho grande" data-accion="pomo-pausar">Pausar</button>') +
        (fase === 'descanso' ? '<button type="button" class="boton secundario ancho" data-accion="pomo-saltar">Saltar el descanso</button>' : '') +
        '<button type="button" class="boton peligro ancho" data-accion="pomo-terminar">Terminar</button>';
    }

    return '<main class="pantalla con-nav pomodoro-pantalla fase-' + fase + '">' +
      ui.encabezado('Pomodoro', null, '<span class="chip-mini">' + e.foco + ' + ' + e.descanso + ' min</span>') +
      '<section class="reloj-pomodoro" aria-label="Temporizador">' +
      '<p class="fase-pomodoro" style="color:' + color + '">' + titulos[fase] + (T.pausado ? ' · en pausa' : '') + '</p>' +
      '<div class="anillo">' +
      '<svg viewBox="0 0 240 240" aria-hidden="true">' +
      '<circle cx="120" cy="120" r="' + RADIO + '" fill="none" stroke="#262A3A" stroke-width="14"></circle>' +
      '<circle id="pomo-anillo" cx="120" cy="120" r="' + RADIO + '" fill="none" stroke="' + color + '" stroke-width="14" stroke-linecap="butt"' +
      ' stroke-dasharray="' + CIRCUNFERENCIA.toFixed(2) + '" stroke-dashoffset="' + offset.toFixed(2) + '" transform="rotate(-90 120 120)"></circle>' +
      '</svg>' +
      '<div class="anillo-centro">' +
      (fase === 'listo'
        ? AQ.dibujarMascota({ etapa: app.store.mascota(p.id).etapa, estado: 'feliz', color: app.store.mascota(p.id).color, tamanio: 96, grietas: app.store.mascota(p.id).validadas })
        : '<span id="pomo-tiempo" class="tiempo-grande" role="timer" aria-live="off">' + pomodoro.formatear(restante) + '</span>' +
          '<span class="texto-chico">' + (fase === 'foco' ? 'para el descanso' : 'para volver') + '</span>') +
      '</div></div>' +
      (tarea ? '<p class="tarea-pomodoro">' + ui.puntoMateria(s.materia(tarea.materiaId)) + esc(tarea.titulo) + '</p>' : '') +
      '<p class="texto-chico centro">Pomodoros completos en esta sesión: <b>' + e.completados + '</b>' +
      (fase === 'foco' ? '<br>Al terminar este: +' + Math.min(Math.floor(e.foco / 5) * reglas.MONEDAS.POMODORO_POR_5_MIN, Math.max(0, tope - hoyMonedas)) + ' monedas' : '') + '</p>' +
      (fase === 'foco' ? '<p class="consejo">Dejá el celular boca abajo y la carpeta abierta. Si te acordás de algo, anotalo y seguí.</p>' : '') +
      (fase === 'descanso' ? '<p class="consejo">Levantate, tomá agua, estirate. Mejor sin pantallas.</p>' : '') +
      '</section>' +
      '<div class="acciones">' + botones + '</div>' +
      ui.navEstudiante('pomodoro') + '</main>';
  };
})(globalThis.AQ = globalThis.AQ || {});
