/*
 * views-estudiante.js — Pantallas del estudiante y de inicio.
 * Cada vista recibe la app y devuelve el HTML de la pantalla.
 */
(function (AQ) {
  'use strict';

  const { Fecha, util, reglas, ui } = AQ;
  const esc = util.esc;
  const V = AQ.vistas = AQ.vistas || {};

  // ---------- Inicio ----------

  V.bienvenida = function () {
    return '<main class="pantalla centrada">' +
      '<div class="logo">' + ui.moneda(30) + '<span class="titulo-pixel grande">' + esc(AQ.NOMBRE_APP) + '</span></div>' +
      '<p class="texto-suave">La agenda escolar con mascota. Primero, el padre o la madre crea un PIN de 4 números para su panel de control.</p>' +
      '<form class="tarjeta formulario" data-form="crear-pin">' +
      '<label for="pin1">PIN del padre (4 números)</label>' +
      '<input id="pin1" name="pin1" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required>' +
      '<label for="pin2">Repetí el PIN</label>' +
      '<input id="pin2" name="pin2" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="new-password" required>' +
      '<p class="texto-chico">El PIN evita que los chicos aprueben sus propias tareas. No es una contraseña segura: no uses la del banco.</p>' +
      '<button class="boton primario" type="submit">Crear PIN y seguir</button>' +
      '</form>' +
      '<p class="texto-chico centro">¿Tenés una copia de seguridad? <button type="button" class="enlace" data-accion="importar-inicio">Importar archivo</button> o <button type="button" class="enlace" data-accion="pegar-copia">pegar texto</button></p>' +
      '<input type="file" id="archivo-importar" accept="application/json,.json" hidden data-cambio="importar">' +
      '</main>';
  };

  V.perfiles = function (app) {
    const s = app.store;
    const tarjetas = s.perfiles.map((p) => {
      const m = s.mascota(p.id);
      const r = m.resumen;
      let estado = '<span class="ok">Todo al día</span>';
      if (r.nacida && r.vida <= reglas.VIDA.DEBIL) estado = '<span class="mal">¡La mascota está débil!</span>';
      else if (r.nacida && !r.comioHoy && !r.vacaciones) estado = '<span class="alerta">La mascota tiene hambre</span>';
      else if (r.vencidas) estado = '<span class="mal">' + r.vencidas + (r.vencidas === 1 ? ' vencida' : ' vencidas') + '</span>';
      else if (r.urgentes) estado = '<span class="alerta">' + r.urgentes + ' para hoy o mañana</span>';
      else if (!r.tieneTareas) estado = '<span class="texto-suave">Sin tareas todavía</span>';
      // Debajo de la mascota va el nombre de la mascota; el del estudiante queda para lectores de pantalla.
      return '<button type="button" class="tarjeta-perfil" data-accion="entrar" data-id="' + p.id + '" aria-label="Entrar como ' + esc(p.nombre) + ' (mascota ' + esc(p.mascota.nombre) + ')">' +
        AQ.dibujarMascota({ etapa: m.etapa, estado: m.estado, color: m.color, tamanio: 88, grietas: m.validadas }) +
        '<span class="nombre-perfil">' + esc(p.mascota.nombre) + '</span>' +
        (r.nacida ? ui.vida(m.vida, reglas.VIDA.MAX, true) : '<span class="texto-chico">Huevo · ' + m.validadas + ' de ' + reglas.TAREAS_PARA_NACER + '</span>') +
        '<span class="monedas">' + ui.moneda(14) + s.saldo(p.id) + '</span>' +
        '<span class="texto-chico">' + estado + '</span></button>';
    }).join('');
    return '<main class="pantalla">' +
      '<div class="logo">' + ui.moneda(28) + '<span class="titulo-pixel grande">' + esc(AQ.NOMBRE_APP) + '</span></div>' +
      '<h1 class="subtitulo">¿Quién va a estudiar hoy?</h1>' +
      (s.perfiles.length ? '<div class="grilla-perfiles">' + tarjetas + '</div>'
        : ui.vacio('Todavía no hay perfiles.', '<button type="button" class="boton primario" data-accion="pedir-pin" data-destino="perfil-form">Crear el primer perfil</button>')) +
      '<div class="espaciador"></div>' +
      '<button type="button" class="boton secundario ancho" data-accion="pedir-pin" data-destino="padre">' + ui.icono('candado', 18) + 'Panel del padre · pide PIN</button>' +
      '<p class="texto-chico centro">Los datos se guardan en este navegador.</p>' +
      '</main>';
  };

  // ---------- Hoy ----------

  function tarjetaMascota(app, grande) {
    const s = app.store;
    const m = s.mascota(app.perfilId);
    const feliz = app.felizActivo();
    const estado = feliz ? 'feliz' : m.estado;
    const info = reglas.TEXTO_ESTADO[estado];
    const faltan = reglas.TAREAS_PARA_NACER - m.validadas;
    const mensaje = m.etapa === 'huevo'
      ? (m.validadas === 0
        ? 'Soy un huevo. Cuando papá te valide ' + reglas.TAREAS_PARA_NACER + ' tareas, salgo. Mientras tanto, las monedas se guardan.'
        : '¡El huevo se está rajando! ' + (faltan === 1 ? 'Falta 1 tarea validada' : 'Faltan ' + faltan + ' tareas validadas') + ' para que salga.')
      : (feliz && app.mensajeFeliz) ? app.mensajeFeliz : reglas.mensajeMascota(estado, m.resumen, m.nombre);
    const costo = reglas.VIDA.COSTO_COMIDA;
    let comida = '';
    if (m.etapa !== 'huevo') {
      if (m.comioHoy) comida = '<span class="chip-mini ok">Ya comió hoy</span>';
      else if (s.saldo(app.perfilId) >= costo) comida = '<button type="button" class="boton primario chico boton-comida" data-accion="alimentar">Darle de comer · ' + ui.moneda(14) + costo + '</button>';
      else comida = '<button type="button" class="boton apagado chico boton-comida" disabled>Faltan ' + (costo - s.saldo(app.perfilId)) + ' para comida</button>';
      if (m.vacaciones) comida += '<span class="chip-mini">Modo vacaciones: no pierde vida</span>';
    }
    return '<section class="tarjeta-mascota' + (grande ? ' grande' : '') + '" style="background:' + m.fondo.css + '" aria-label="Tu mascota">' +
      '<div class="mascota-caja' + (feliz ? ' salta' : '') + (m.etapa === 'huevo' && m.validadas > 0 ? ' tiembla' : '') + '">' +
      AQ.dibujarMascota({ etapa: m.etapa, estado, color: m.color, tamanio: grande ? 144 : 96, grietas: m.validadas }) +
      (feliz ? '<span class="chispas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>' : '') +
      '</div>' +
      '<div class="mascota-info">' +
      '<div class="fila-entre"><span class="titulo-pixel">' + esc(m.nombre) + '</span><span class="estado-mascota" style="color:' + info.color + '">' + (m.etapa === 'huevo' ? 'Huevo' : info.nombre) + '</span></div>' +
      '<p class="mensaje-mascota" aria-live="polite">' + esc(mensaje) + '</p>' +
      (m.etapa === 'huevo'
        ? '<div class="progreso-huevo" role="img" aria-label="' + m.validadas + ' de ' + reglas.TAREAS_PARA_NACER + ' tareas validadas">' +
          Array.from({ length: reglas.TAREAS_PARA_NACER }, (_, i) => '<i class="' + (i < m.validadas ? 'lleno' : '') + '"></i>').join('') +
          '<span>' + m.validadas + ' de ' + reglas.TAREAS_PARA_NACER + ' tareas validadas</span></div>' :
        '<div class="medidores"><span>Vida</span>' + ui.vida(m.vida, reglas.VIDA.MAX) +
        '<span>Ánimo</span>' + ui.barra(m.animo, '#6EC5FF', 'Ánimo') + '</div>' +
        '<div class="fila-comida">' + comida + '</div>') +
      '</div></section>';
  }

  function seccionTareas(titulo, clase, lista, app) {
    if (!lista.length) return '';
    return '<section class="seccion"><h2 class="titulo-seccion ' + clase + '">' + titulo + '</h2>' +
      lista.map((t) => ui.filaTarea(t, app.store.materia(t.materiaId))).join('') + '</section>';
  }

  V.hoy = function (app) {
    const s = app.store;
    const p = app.perfil();
    const hoy = Fecha.hoy();
    const manana = Fecha.sumarDias(hoy, 1);
    const tareas = s.tareasDe(p.id).slice().sort((a, b) => a.vence.localeCompare(b.vence));
    const pend = tareas.filter((t) => t.estado === 'pendiente');
    const vencidas = pend.filter((t) => t.vence < hoy);
    const paraHoy = pend.filter((t) => t.vence === hoy);
    const paraManana = pend.filter((t) => t.vence === manana);
    const proximos = pend.filter((t) => t.vence > manana);
    const enviadas = tareas.filter((t) => t.estado === 'enviada');
    const examenes = s.examenesDe(p.id).filter((x) => x.fecha >= hoy).slice(0, 2);
    const sinMaterias = s.materiasDe(p.id).length === 0;

    let cuerpo = '';
    if (sinMaterias) {
      cuerpo = ui.vacio('Para empezar, cargá las materias que tenés este año.',
        '<button type="button" class="boton primario" data-accion="ir" data-pantalla="materia-form">Agregar materias</button>');
    } else if (!pend.length && !enviadas.length) {
      cuerpo = ui.vacio('No tenés nada pendiente. Si te dieron tarea, anotala con el botón +.');
    }
    // "Para validar" va primero: es lo que el estudiante le muestra al padre.
    cuerpo += (enviadas.length
        ? '<section class="seccion validar-bloque"><div class="fila-entre"><h2 class="titulo-seccion ok">Para validar</h2></div>' +
          '<div class="aviso-validar">' + ui.icono('candado', 20) + '<span>Mostrale a tu papá lo que hiciste. Con su PIN, cada tarea validada suma <strong>+' + reglas.MONEDAS.A_TIEMPO + '</strong> (a tiempo).</span></div>' +
          '<button type="button" class="boton primario ancho" data-accion="validar">Validar con papá (' + enviadas.length + ')</button>' +
          enviadas.map((t) => ui.filaTarea(t, app.store.materia(t.materiaId))).join('') + '</section>'
        : '') +
      seccionTareas('Vencido', 'mal', vencidas, app) +
      seccionTareas('Para hoy', 'alerta', paraHoy, app) +
      seccionTareas('Para mañana', 'alerta', paraManana, app) +
      seccionTareas('Próximos días', '', proximos, app);

    const tarjetasExamen = examenes.map((x) => {
      const mat = s.materia(x.materiaId);
      const ses = s.sesionesDe(x.id);
      const hechas = ses.filter((t) => t.estado !== 'pendiente').length;
      const faltan = Fecha.diferencia(hoy, x.fecha);
      return '<button type="button" class="tarjeta-examen" data-accion="ir" data-pantalla="examen" data-id="' + x.id + '">' +
        '<span class="etiqueta-azul">Examen · ' + (faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : 'en ' + faltan + ' días') + '</span>' +
        '<span class="fila-titulo">' + esc(mat ? mat.nombre : '') + (x.temas ? ': ' + esc(x.temas) : '') + '</span>' +
        '<span class="texto-chico">' + esc(Fecha.larga(x.fecha)) + '</span>' +
        (ses.length ? '<span class="segmentos">' + ses.map((t) => '<i class="' + (t.estado !== 'pendiente' ? 'lleno' : '') + '"></i>').join('') + '</span>' +
          '<span class="texto-chico">Sesiones de estudio: ' + hechas + ' de ' + ses.length + '</span>' : '') +
        '</button>';
    }).join('');

    return '<main class="pantalla con-nav">' +
      '<header class="barra">' +
      ui.botonAjustes('hoy') +
      '<div class="saludo"><span class="texto-chico">' + esc(Fecha.larga(hoy)) + '</span><h1 class="titulo-pixel">Hola, ' + esc(p.nombre) + '</h1></div>' +
      '<button type="button" class="pastilla-monedas" data-accion="ir" data-pantalla="mascota" aria-label="Monedas: ' + s.saldo(p.id) + '. Ir a la tienda">' + ui.moneda(16) + s.saldo(p.id) + '</button>' +
      '</header>' +
      tarjetaMascota(app, false) +
      cuerpo +
      (tarjetasExamen ? '<section class="seccion"><h2 class="titulo-seccion azul">Próximos exámenes</h2>' + tarjetasExamen + '</section>' : '') +
      '<button type="button" class="fab" data-accion="ir" data-pantalla="' + (sinMaterias ? 'materia-form' : 'tarea-form') + '" aria-label="Anotar una tarea nueva">' + ui.icono('mas', 28, 3) + '</button>' +
      ui.navEstudiante('hoy') +
      '</main>';
  };

  // ---------- Formulario de tarea ----------

  V['tarea-form'] = function (app) {
    const s = app.store;
    const p = app.perfil();
    const edit = app.params.id ? s.tarea(app.params.id) : null;
    const esSesion = edit && edit.tipo === 'sesion';
    const materias = s.materiasDe(p.id);
    const materiaSel = edit ? edit.materiaId : (app.params.materiaId || (materias[0] && materias[0].id));
    const hoy = Fecha.hoy();
    const vence = edit ? edit.vence : Fecha.sumarDias(hoy, 1);
    const volver = app.params.volver || (edit ? 'tarea' : 'hoy');

    const chips = materias.map((m) =>
      '<label class="chip-radio"><input type="radio" name="materiaId" value="' + m.id + '"' + (m.id === materiaSel ? ' checked' : '') + (esSesion ? ' disabled' : '') + '>' +
      '<span>' + ui.puntoMateria(m) + esc(m.nombre) + '</span></label>').join('');

    const rapidas = [['Mañana', 1], ['Pasado', 2], ['En una semana', 7]].map(([n, d]) =>
      '<button type="button" class="chip" data-accion="fecha-rapida" data-valor="' + Fecha.sumarDias(hoy, d) + '">' + n + '</button>').join('');

    return '<main class="pantalla">' +
      ui.encabezado(edit ? (esSesion ? 'Mover sesión' : 'Editar tarea') : (app.modoPadre ? 'Tarea para ' + p.nombre : 'Nueva tarea'), volver) +
      (!edit && !app.modoPadre ? '<div class="aviso-monedas">' + ui.moneda(18) + '<span>Anotarla el mismo día que te la dan suma <strong>+' + reglas.MONEDAS.ANOTAR + '</strong></span></div>' : '') +
      '<form class="formulario" data-form="tarea">' +
      (esSesion ? '<p class="texto-suave">' + esc(edit.titulo) + '</p>' :
        '<fieldset><legend>Materia</legend><div class="grilla-chips">' + chips + '</div>' +
        '<button type="button" class="enlace" data-accion="ir" data-pantalla="materia-form" data-volver="tarea-form">+ Agregar otra materia</button></fieldset>' +
        '<label for="titulo">¿Qué hay que hacer?</label>' +
        '<input id="titulo" name="titulo" type="text" maxlength="120" required placeholder="Ej.: ejercicios 12 a 20, página 45" value="' + esc(edit ? edit.titulo : '') + '">' +
        '<label for="detalle">Detalles (opcional)</label>' +
        '<textarea id="detalle" name="detalle" rows="2" maxlength="500" placeholder="Ej.: en la carpeta, con letra prolija">' + esc(edit ? edit.detalle : '') + '</textarea>') +
      '<label for="vence">' + (esSesion ? 'Día de la sesión' : '¿Para cuándo?') + '</label>' +
      '<div class="fila-chips">' + rapidas + '</div>' +
      '<input id="vence" name="vence" type="date" required value="' + vence + '">' +
      (esSesion ? '' :
        '<div class="foto-campo">' +
        '<label class="boton secundario ancho" for="foto">' + ui.icono('camara', 20) + 'Foto del pizarrón (opcional)</label>' +
        '<input id="foto" type="file" accept="image/*" capture="environment" hidden data-cambio="foto">' +
        '<div id="foto-preview" class="foto-preview">' + (app.fotoTemporal ? '<img src="' + app.fotoTemporal + '" alt="Foto adjunta"><button type="button" class="enlace" data-accion="quitar-foto">Quitar foto</button>' : '') + '</div>' +
        '</div>') +
      '<button class="boton primario ancho" type="submit">' + (edit ? 'Guardar cambios' : (app.modoPadre ? 'Agregar tarea' : 'Anotar tarea · +' + reglas.MONEDAS.ANOTAR)) + '</button>' +
      '</form></main>';
  };

  // ---------- Detalle de tarea ----------

  V.tarea = function (app) {
    const s = app.store;
    const t = s.tarea(app.params.id);
    if (!t) return V.hoy(app);
    const m = s.materia(t.materiaId);
    const estados = { pendiente: 'Pendiente', enviada: 'Hecha, falta que papá la valide', aprobada: 'Validada' };
    const puedeEditar = t.estado !== 'aprobada';
    const puedeBorrar = t.estado !== 'aprobada' && (t.creadaPor === 'estudiante' || app.modoPadre);
    return '<main class="pantalla">' +
      ui.encabezado(t.tipo === 'sesion' ? 'Sesión de estudio' : 'Tarea', app.modoPadre ? 'padre' : (app.params.volver || 'hoy')) +
      '<article class="tarjeta detalle">' +
      '<span class="meta">' + ui.puntoMateria(m) + esc(m ? m.nombre : '') + '</span>' +
      '<h2 class="titulo-detalle">' + esc(t.titulo) + '</h2>' +
      '<dl class="datos">' +
      '<dt>' + (t.tipo === 'sesion' ? 'Día' : 'Entrega') + '</dt><dd>' + esc(Fecha.larga(t.vence)) + ' (' + esc(Fecha.relativa(t.vence)) + ')</dd>' +
      '<dt>Estado</dt><dd>' + estados[t.estado] + '</dd>' +
      (t.detalle ? '<dt>' + (t.tipo === 'sesion' ? 'Temas' : 'Detalles') + '</dt><dd>' + esc(t.detalle) + '</dd>' : '') +
      (t.nota && t.estado === 'pendiente' ? '<dt>Nota de papá</dt><dd class="aviso-nota">' + esc(t.nota) + '</dd>' : '') +
      '</dl>' +
      (t.foto ? '<img class="foto-grande" src="' + t.foto + '" alt="Foto adjunta a la tarea">' : '') +
      '</article>' +
      '<div class="acciones">' +
      (t.estado === 'pendiente' && !app.modoPadre ? '<button type="button" class="boton primario ancho" data-accion="marcar" data-id="' + t.id + '">' + ui.icono('check', 20, 3) + 'Ya la hice</button>' : '') +
      (t.estado === 'enviada' && !app.modoPadre ? '<button type="button" class="boton primario ancho" data-accion="validar">' + ui.icono('candado', 18) + 'Validar con papá</button>' +
        '<button type="button" class="boton secundario ancho" data-accion="desmarcar" data-id="' + t.id + '">Todavía no la terminé</button>' : '') +
      (puedeEditar ? '<button type="button" class="boton secundario ancho" data-accion="ir" data-pantalla="tarea-form" data-id="' + t.id + '">' + ui.icono('lapiz', 18) + (t.tipo === 'sesion' ? 'Cambiar el día' : 'Editar') + '</button>' : '') +
      (puedeBorrar ? '<button type="button" class="boton peligro ancho" data-accion="borrar-tarea" data-id="' + t.id + '">' + ui.icono('basura', 18) + 'Borrar' + (s.monedasDeTarea(t.id) ? ' (descuenta ' + s.monedasDeTarea(t.id) + ' monedas)' : '') + '</button>' : '') +
      '</div></main>';
  };

  // ---------- Exámenes ----------

  V.examenes = function (app) {
    const s = app.store;
    const p = app.perfil();
    const hoy = Fecha.hoy();
    const todos = s.examenesDe(p.id);
    const proximos = todos.filter((x) => x.fecha >= hoy);
    const pasados = todos.filter((x) => x.fecha < hoy).reverse();
    const fila = (x) => {
      const m = s.materia(x.materiaId);
      const ses = s.sesionesDe(x.id);
      const hechas = ses.filter((t) => t.estado !== 'pendiente').length;
      return '<button type="button" class="fila-examen" data-accion="ir" data-pantalla="examen" data-id="' + x.id + '">' +
        '<span class="fecha-bloque"><small>' + Fecha.diaCorto(x.fecha) + '</small><b>' + Fecha.numeroDia(x.fecha) + '</b></span>' +
        '<span class="fila-examen-texto"><span class="fila-titulo">' + ui.puntoMateria(m) + esc(m ? m.nombre : '') + '</span>' +
        '<span class="texto-chico">' + (x.temas ? esc(x.temas) + ' · ' : '') +
        (x.fecha >= hoy ? 'Sesiones ' + hechas + ' de ' + ses.length : (x.nota ? 'Nota: ' + esc(x.nota) : 'Sin nota cargada')) + '</span></span></button>';
    };
    return '<main class="pantalla con-nav">' +
      ui.encabezado('Exámenes', null, ui.botonAjustes('examenes')) +
      '<button type="button" class="boton primario ancho" data-accion="ir" data-pantalla="examen-form">' + ui.icono('mas', 20, 3) + 'Agendar examen</button>' +
      '<section class="seccion"><h2 class="titulo-seccion azul">Próximos</h2>' +
      (proximos.length ? proximos.map(fila).join('') : ui.vacio('No tenés exámenes agendados.')) + '</section>' +
      (pasados.length ? '<section class="seccion"><h2 class="titulo-seccion">Anteriores</h2>' + pasados.slice(0, 15).map(fila).join('') + '</section>' : '') +
      ui.navEstudiante('examenes') + '</main>';
  };

  V['examen-form'] = function (app) {
    const s = app.store;
    const p = app.perfil();
    const materias = s.materiasDe(p.id);
    if (!materias.length) {
      return '<main class="pantalla">' + ui.encabezado('Nuevo examen', 'examenes') +
        ui.vacio('Primero cargá tus materias.', '<button type="button" class="boton primario" data-accion="ir" data-pantalla="materia-form">Agregar materias</button>') + '</main>';
    }
    const fecha = Fecha.sumarDias(Fecha.hoy(), 7);
    const chips = materias.map((m, i) =>
      '<label class="chip-radio"><input type="radio" name="materiaId" value="' + m.id + '"' + (i === 0 ? ' checked' : '') + '>' +
      '<span>' + ui.puntoMateria(m) + esc(m.nombre) + '</span></label>').join('');
    return '<main class="pantalla">' +
      ui.encabezado('Nuevo examen', app.modoPadre ? 'padre' : 'examenes') +
      '<form class="formulario" data-form="examen">' +
      '<fieldset><legend>Materia</legend><div class="grilla-chips">' + chips + '</div></fieldset>' +
      '<label for="fecha">Fecha del examen</label>' +
      '<input id="fecha" name="fecha" type="date" required min="' + Fecha.hoy() + '" value="' + fecha + '" data-cambio="plan">' +
      '<label for="temas">Temas</label>' +
      '<input id="temas" name="temas" type="text" maxlength="200" placeholder="Ej.: ecuaciones de primer grado y problemas">' +
      '<section class="tarjeta plan"><h2 class="titulo-pixel azul">Plan de estudio sugerido</h2>' +
      '<p class="texto-chico">Estudiar un poco en varios días rinde más que todo la noche anterior. Cada sesión aprobada suma +' + reglas.MONEDAS.SESION + '. Después podés mover cualquier sesión de día.</p>' +
      '<ol id="plan-preview" class="lista-plan">' + V.planPreview(app, fecha) + '</ol></section>' +
      '<button class="boton primario ancho" type="submit">Guardar examen</button>' +
      '</form></main>';
  };

  V.planPreview = function (app, fecha) {
    const plan = app.store.previsualizarPlan(fecha);
    if (!plan.length) return '<li class="texto-chico">El examen es muy pronto para repartir sesiones. ¡A repasar hoy!</li>';
    return plan.map((x) => '<li><span class="fecha-bloque"><small>' + Fecha.diaCorto(x.fecha) + '</small><b>' + Fecha.numeroDia(x.fecha) + '</b></span>' +
      '<span>' + esc(x.titulo) + '</span><span class="monedas-chico">+' + reglas.MONEDAS.SESION + '</span></li>').join('');
  };

  V.examen = function (app) {
    const s = app.store;
    const x = s.examen(app.params.id);
    if (!x) return V.examenes(app);
    const m = s.materia(x.materiaId);
    const hoy = Fecha.hoy();
    const faltan = Fecha.diferencia(hoy, x.fecha);
    const ses = s.sesionesDe(x.id);
    const cuando = faltan > 1 ? 'Faltan ' + faltan + ' días' : faltan === 1 ? 'Es mañana' : faltan === 0 ? 'Es hoy' : 'Fue hace ' + (-faltan) + (faltan === -1 ? ' día' : ' días');
    return '<main class="pantalla">' +
      ui.encabezado('Examen', app.modoPadre ? 'padre' : 'examenes') +
      '<article class="tarjeta detalle">' +
      '<span class="meta">' + ui.puntoMateria(m) + esc(m ? m.nombre : '') + '</span>' +
      '<h2 class="titulo-detalle">' + esc(Fecha.larga(x.fecha)) + '</h2>' +
      '<p class="texto-suave">' + cuando + (x.temas ? ' · ' + esc(x.temas) : '') + '</p>' +
      '</article>' +
      (ses.length ? '<section class="seccion"><h2 class="titulo-seccion azul">Sesiones de estudio</h2>' +
        ses.map((t) => t.estado === 'aprobada'
          ? '<div class="fila-tarea hecha"><span class="fila-cuerpo"><span class="meta">' + esc(Fecha.relativa(t.vence)) + '</span><span class="fila-titulo">' + esc(t.titulo) + '</span><span class="aviso-ok">Aprobada · +' + reglas.MONEDAS.SESION + '</span></span></div>'
          : ui.filaTarea(t, m, { modo: app.modoPadre ? 'lectura' : 'estudiante' })).join('') + '</section>' : '') +
      (faltan <= 0 ? '<form class="tarjeta formulario" data-form="nota-examen" data-id="' + x.id + '">' +
        '<label for="nota">¿Cómo te fue? Nota del examen</label>' +
        '<div class="fila-form"><input id="nota" name="nota" type="text" maxlength="10" value="' + esc(x.nota) + '" placeholder="Ej.: 8">' +
        '<button class="boton primario" type="submit">Guardar</button></div></form>' : '') +
      '<button type="button" class="boton peligro ancho" data-accion="borrar-examen" data-id="' + x.id + '">' + ui.icono('basura', 18) + 'Borrar examen</button>' +
      '</main>';
  };

  // ---------- Materias ----------

  V.materias = function (app) {
    const s = app.store;
    const lista = s.materiasDe(app.perfilId);
    return '<main class="pantalla con-nav">' +
      ui.encabezado('Materias', null, ui.botonAjustes('materias')) +
      '<button type="button" class="boton primario ancho" data-accion="ir" data-pantalla="materia-form">' + ui.icono('mas', 20, 3) + 'Agregar materia</button>' +
      (lista.length ? '<ul class="lista-simple">' + lista.map((m) =>
        '<li><span class="cuadro-color" style="background:' + esc(m.color) + '"></span>' +
        '<span class="lista-texto"><b>' + esc(m.nombre) + '</b>' + (m.profesor ? '<small>' + esc(m.profesor) + '</small>' : '') + '</span>' +
        '<button type="button" class="boton-icono" data-accion="ir" data-pantalla="materia-form" data-id="' + m.id + '" aria-label="Editar ' + esc(m.nombre) + '">' + ui.icono('lapiz', 18) + '</button>' +
        '</li>').join('') + '</ul>' : ui.vacio('Todavía no cargaste materias.')) +
      ui.navEstudiante('materias') + '</main>';
  };

  V['materia-form'] = function (app) {
    const s = app.store;
    const m = app.params.id ? s.materia(app.params.id) : null;
    const colorSel = m ? m.color : reglas.COLORES_MATERIA[s.materiasDe(app.perfilId).length % reglas.COLORES_MATERIA.length];
    const colores = reglas.COLORES_MATERIA.map((c, i) =>
      '<label class="muestra"><input type="radio" name="color" value="' + c + '"' + (c === colorSel ? ' checked' : '') + '>' +
      '<span style="background:' + c + '"><span class="solo-lectores">Color ' + (i + 1) + '</span></span></label>').join('');
    const volver = app.params.volver || 'materias';
    return '<main class="pantalla">' +
      ui.encabezado(m ? 'Editar materia' : 'Nueva materia', volver) +
      '<form class="formulario" data-form="materia">' +
      '<label for="nombre">Nombre</label>' +
      '<input id="nombre" name="nombre" type="text" maxlength="30" required placeholder="Ej.: Matemática" value="' + esc(m ? m.nombre : '') + '">' +
      '<label for="profesor">Profesor o profesora (opcional)</label>' +
      '<input id="profesor" name="profesor" type="text" maxlength="40" value="' + esc(m ? m.profesor : '') + '">' +
      '<fieldset><legend>Color</legend><div class="fila-muestras">' + colores + '</div></fieldset>' +
      '<button class="boton primario ancho" type="submit">' + (m ? 'Guardar' : 'Agregar materia') + '</button>' +
      (!m ? '<button class="boton secundario ancho" type="submit" name="otra" value="1">Agregar y cargar otra</button>' : '') +
      '</form>' +
      (m ? '<button type="button" class="boton peligro ancho" data-accion="borrar-materia" data-id="' + m.id + '">' + ui.icono('basura', 18) + 'Borrar materia</button>' : '') +
      '</main>';
  };

  // ---------- Mascota y tienda ----------

  V.mascota = function (app) {
    const s = app.store;
    const p = app.perfil();
    const m = s.mascota(p.id);
    const saldo = s.saldo(p.id);
    const xpNivel = m.xp % reglas.XP_POR_NIVEL;
    const prox = reglas.PROXIMA_ETAPA[m.etapa];

    const premios = s.premios.map((pr) => {
      const alcanza = saldo >= pr.precio;
      return '<li class="fila-premio"><span class="lista-texto"><b>' + esc(pr.nombre) + '</b><small class="monedas-chico">' + ui.moneda(12) + pr.precio + '</small></span>' +
        '<button type="button" class="boton ' + (alcanza ? 'primario' : 'apagado') + ' chico" data-accion="canjear" data-id="' + pr.id + '"' + (alcanza ? '' : ' disabled') + '>' +
        (alcanza ? 'Canjear' : 'Faltan ' + (pr.precio - saldo)) + '</button></li>';
    }).join('');

    const canjes = s.canjesDe(p.id).filter((c) => !c.entregado);

    const cosmeticos = (tipo, titulo) => '<h3 class="titulo-chico">' + titulo + '</h3><div class="grilla-cosmeticos">' +
      reglas.COSMETICOS[tipo].map((c) => {
        const tiene = p.mascota[tipo].includes(c.id);
        const puesto = (tipo === 'colores' ? p.mascota.color : p.mascota.fondo) === c.id;
        const muestra = tipo === 'colores'
          ? AQ.dibujarMascota({ etapa: m.etapa === 'huevo' ? 'bebe' : m.etapa, estado: 'tranquilo', color: c, tamanio: 48 })
          : '<span class="muestra-fondo" style="background:' + c.css + '"></span>';
        let boton;
        if (puesto) boton = '<span class="chip-mini ok">Puesto</span>';
        else if (tiene) boton = '<button type="button" class="boton secundario chico" data-accion="equipar" data-tipo="' + tipo + '" data-id="' + c.id + '">Usar</button>';
        else boton = '<button type="button" class="boton ' + (saldo >= c.precio ? 'primario' : 'apagado') + ' chico" data-accion="comprar" data-tipo="' + tipo + '" data-id="' + c.id + '"' + (saldo >= c.precio ? '' : ' disabled') + '>' + ui.moneda(12) + c.precio + '</button>';
        return '<div class="cosmetico">' + muestra + '<span class="texto-chico">' + esc(c.nombre) + '</span>' + boton + '</div>';
      }).join('') + '</div>';

    const movs = s.movimientosDe(p.id).slice(-12).reverse();

    return '<main class="pantalla con-nav">' +
      ui.encabezado('Tu mascota', null, '<span class="pastilla-monedas">' + ui.moneda(16) + saldo + '</span>' + ui.botonAjustes('mascota')) +
      tarjetaMascota(app, true) +
      '<section class="tarjeta">' +
      '<div class="fila-entre"><b>Nivel ' + m.nivel + ' · ' + reglas.NOMBRE_ETAPA[m.etapa] + '</b><span class="texto-chico">' + xpNivel + ' / ' + reglas.XP_POR_NIVEL + '</span></div>' +
      ui.barra(100 * xpNivel / reglas.XP_POR_NIVEL, '#C6F25B', 'Experiencia del nivel') +
      '<p class="texto-chico">' + (m.etapa === 'huevo' ? 'Sale del huevo cuando papá te valide ' + reglas.TAREAS_PARA_NACER + ' tareas (van ' + m.validadas + ').' : prox ? 'Evoluciona a ' + prox.nombre + ' en el nivel ' + prox.nivel + '.' : 'Ya llegó a su última etapa. ¡Crack!') + '</p>' +
      '</section>' +
      '<section class="seccion"><div class="fila-entre"><h2 class="titulo-seccion">Premios reales</h2><span class="texto-chico">los define papá</span></div>' +
      (premios ? '<ul class="lista-simple">' + premios + '</ul>' : ui.vacio('Todavía no hay premios. Pedile a tu papá que cargue algunos.')) + '</section>' +
      (canjes.length ? '<section class="seccion"><h2 class="titulo-seccion ok">Canjes por recibir</h2><ul class="lista-simple">' +
        canjes.map((c) => '<li><span class="lista-texto"><b>' + esc(c.nombre) + '</b><small>Canjeado ' + esc(Fecha.relativa(c.fecha)) + '</small></span></li>').join('') + '</ul></section>' : '') +
      '<section class="seccion"><h2 class="titulo-seccion">Para tu mascota</h2>' + cosmeticos('colores', 'Colores') + cosmeticos('fondos', 'Fondos') + '</section>' +
      '<section class="seccion"><h2 class="titulo-seccion">Últimos movimientos</h2>' +
      (movs.length ? '<ul class="lista-movs">' + movs.map((mv) =>
        '<li><span>' + esc(mv.motivo) + '<small>' + esc(Fecha.relativa(mv.fecha)) + '</small></span><b class="' + (mv.cantidad >= 0 ? 'ok' : 'mal') + '">' + (mv.cantidad > 0 ? '+' : '') + mv.cantidad + '</b></li>').join('') + '</ul>'
        : ui.vacio('Todavía no hay movimientos.')) + '</section>' +
      '<section class="tarjeta"><h2 class="titulo-chico">Cómo se ganan monedas</h2><ul class="lista-reglas">' +
      '<li>Anotar una tarea: +' + reglas.MONEDAS.ANOTAR + '</li>' +
      '<li>Marcarla como hecha: +' + reglas.MONEDAS.HECHA + '</li>' +
      '<li>Cuando papá la valida, si la hiciste a tiempo: +' + reglas.MONEDAS.A_TIEMPO + '</li>' +
      '<li>Cuando papá la valida, si la hiciste tarde: +' + reglas.MONEDAS.TARDE + '</li>' +
      '<li>Sesión de estudio validada: +' + reglas.MONEDAS.SESION + '</li>' +
      '<li>Pomodoro completo: +1 cada 5 minutos (hasta ' + reglas.MONEDAS.TOPE_POMODORO_DIA + ' por día)</li>' +
      '<li>5 días seguidos de revisión con papá: +' + reglas.MONEDAS.RACHA_REVISION + '</li>' +
      '<li>Semana sin tareas vencidas: +' + reglas.MONEDAS.SEMANA_LIMPIA + '</li>' +
      '</ul><h2 class="titulo-chico">Cómo se cuida la mascota</h2><ul class="lista-reglas">' +
      '<li>Come una vez por día: cuesta ' + reglas.VIDA.COSTO_COMIDA + ' monedas y le devuelve 1 de vida.</li>' +
      '<li>Cada día que pasa sin comer (porque no entraste o no había monedas) pierde 1 de vida.</li>' +
      '<li>Con ' + reglas.VIDA.DEBIL + ' de vida o menos se pone débil. Con 0 queda sin fuerzas, pero no se muere: comiendo se recupera.</li>' +
      '</ul></section>' +
      ui.navEstudiante('mascota') + '</main>';
  };
})(globalThis.AQ = globalThis.AQ || {});

/*
 * Configuración del estudiante: preferencias que guarda cada perfil.
 */
(function (AQ) {
  'use strict';

  const { util, ui, pomodoro } = AQ;
  const esc = util.esc;
  const V = AQ.vistas;

  function opciones(nombre, lista, elegido) {
    return '<div class="segmentado" role="radiogroup">' + lista.map(([valor, texto]) =>
      '<label class="chip-radio"><input type="radio" name="' + nombre + '" value="' + valor + '"' + (String(valor) === String(elegido) ? ' checked' : '') + ' data-cambio="ajuste">' +
      '<span>' + texto + '</span></label>').join('') + '</div>';
  }

  function interruptor(nombre, titulo, detalle, activo) {
    return '<label class="fila-ajuste interruptor" for="aj-' + nombre + '">' +
      '<span class="lista-texto"><b>' + titulo + '</b><small>' + detalle + '</small></span>' +
      '<input type="checkbox" role="switch" id="aj-' + nombre + '" name="' + nombre + '"' + (activo ? ' checked' : '') + ' data-cambio="ajuste">' +
      '<span class="switch" aria-hidden="true"></span></label>';
  }

  V.ajustes = function (app) {
    const s = app.store;
    const p = app.perfil();
    const a = s.ajustes(p.id);
    return '<main class="pantalla">' +
      ui.encabezado('Configuración', app.params.volver || 'hoy') +

      '<section class="tarjeta seccion-ajustes"><h2 class="titulo-chico">Tu cuenta</h2>' +
      '<div class="fila-ajuste"><span class="lista-texto"><b>' + esc(p.nombre) + '</b><small>' + (p.anio ? esc(p.anio) + ' · ' : '') + 'Nivel ' + s.nivel(p.id) + '</small></span></div>' +
      '<form class="formulario" data-form="nombre-mascota">' +
      '<label for="nombre-mascota">Nombre de tu mascota</label>' +
      '<div class="fila-form"><input id="nombre-mascota" name="nombre" type="text" maxlength="20" required value="' + esc(p.mascota.nombre) + '">' +
      '<button class="boton secundario" type="submit">Guardar</button></div></form>' +
      '</section>' +

      '<section class="tarjeta seccion-ajustes"><h2 class="titulo-chico">Pantalla</h2>' +
      '<p class="etiqueta-ajuste">Tamaño de letra</p>' +
      opciones('letra', [['normal', 'Normal'], ['grande', 'Grande'], ['muy-grande', 'Muy grande']], a.letra) +
      interruptor('animaciones', 'Animaciones', 'Saltos y chispas de la mascota.', a.animaciones) +
      '</section>' +

      '<section class="tarjeta seccion-ajustes"><h2 class="titulo-chico">Pomodoro</h2>' +
      '<p class="etiqueta-ajuste">Tiempo de estudio que aparece elegido</p>' +
      opciones('foco', pomodoro.OPCIONES_FOCO.map((n) => [n, n + ' min']), a.foco) +
      '<p class="etiqueta-ajuste">Descanso que aparece elegido</p>' +
      opciones('descanso', pomodoro.OPCIONES_DESCANSO.map((n) => [n, n + ' min']), a.descanso) +
      interruptor('sonido', 'Sonido al terminar', 'Tres pitidos cuando termina el estudio o el descanso.', a.sonido) +
      (a.sonido ? '<button type="button" class="enlace" data-accion="probar-sonido">Probar sonido</button>' : '') +
      '</section>' +

      '<section class="tarjeta seccion-ajustes"><h2 class="titulo-chico">Sesión</h2>' +
      '<div class="acciones">' +
      '<button type="button" class="boton secundario ancho" data-accion="pedir-pin" data-destino="padre">' + ui.icono('candado', 18) + 'Panel del padre</button>' +
      '<button type="button" class="boton peligro ancho" data-accion="salir-perfil">' + ui.icono('salir', 18) + 'Salir de mi cuenta</button>' +
      '</div>' +
      '<p class="texto-chico">Salir te lleva a la pantalla de perfiles. Tus tareas, monedas y mascota quedan guardadas.</p>' +
      '</section>' +

      '<p class="texto-chico centro">' + esc(AQ.NOMBRE_APP) + ' · Los datos se guardan en este dispositivo.</p>' +
      '</main>';
  };
})(globalThis.AQ = globalThis.AQ || {});
