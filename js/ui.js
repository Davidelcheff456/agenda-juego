/*
 * ui.js — Piezas de interfaz reutilizables (devuelven HTML como texto).
 * Todo texto que viene del usuario pasa por esc() antes de entrar al HTML.
 */
(function (AQ) {
  'use strict';

  const { Fecha, util } = AQ;
  const esc = util.esc;

  const ICONOS = {
    volver: '<path d="M15 5l-7 7 7 7"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    hoy: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    examen: '<path d="M7 3h7l4 4v14H7z"/><path d="M10 12h5M10 16h5"/>',
    materias: '<path d="M4 5h6v15H4zM10 5h4v15h-4zM15 6l4-1 3 14-4 1z"/>',
    mascota: '<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 7V4M9 4h6"/><circle cx="9.5" cy="12.5" r="1"/><circle cx="14.5" cy="12.5" r="1"/>',
    ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    salir: '<path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9"/>',
    basura: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    reloj: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3"/>',
    perfiles: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.9 2.6 2.7 3 5.2"/>'
  };

  function icono(nombre, tam, grosor) {
    return '<svg class="icono" width="' + (tam || 20) + '" height="' + (tam || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (grosor || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONOS[nombre] + '</svg>';
  }

  function moneda(tam) {
    const t = tam || 16;
    return '<svg class="moneda" width="' + t + '" height="' + t + '" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"><rect x="2" y="0" width="4" height="8" fill="#FFB547"/><rect x="0" y="2" width="8" height="4" fill="#FFB547"/><rect x="1" y="1" width="6" height="6" fill="#FFB547"/><rect x="3" y="2" width="2" height="4" fill="#B8791F"/></svg>';
  }

  /** Barra superior con botón volver opcional. */
  function encabezado(titulo, volverA, extra) {
    return '<header class="barra">' +
      (volverA ? '<button type="button" class="boton-icono" data-accion="atras" data-pantalla="' + volverA + '" aria-label="Volver">' + icono('volver', 20, 2.5) + '</button>' : '') +
      '<h1 class="titulo-pixel">' + esc(titulo) + '</h1>' +
      '<div class="barra-extra">' + (extra || '') + '</div></header>';
  }

  function botonAjustes(volver) {
    return '<button type="button" class="boton-icono" data-accion="ir" data-pantalla="ajustes"' + (volver ? ' data-volver="' + volver + '"' : '') +
      ' aria-label="Configuración">' + icono('ajustes', 20) + '</button>';
  }

  function navEstudiante(activa) {
    const items = [
      ['hoy', 'Hoy', 'hoy'], ['examenes', 'Exámenes', 'examen'], ['pomodoro', 'Pomodoro', 'reloj'], ['materias', 'Materias', 'materias'], ['mascota', 'Mascota', 'mascota']
    ];
    return '<nav class="nav-inferior" aria-label="Secciones">' + items.map(([id, nombre, ic]) =>
      '<button type="button" class="nav-item' + (id === activa ? ' activo' : '') + '" data-accion="ir" data-pantalla="' + id + '"' +
      (id === activa ? ' aria-current="page"' : '') + '>' + icono(ic, 22) + '<span>' + nombre + '</span></button>'
    ).join('') + '</nav>';
  }

  function puntoMateria(materia) {
    return '<span class="punto" style="background:' + esc(materia ? materia.color : '#8A8FA3') + '"></span>';
  }

  /**
   * Fila de tarea con casillero.
   * opciones.modo: 'estudiante' (casillero para marcar) o 'lectura'.
   */
  function filaTarea(t, materia, opciones) {
    const op = opciones || {};
    const hoy = Fecha.hoy();
    const vencida = t.estado === 'pendiente' && t.vence < hoy;
    const enviada = t.estado === 'enviada';
    const etiquetaFecha = vencida ? 'venció ' + Fecha.relativa(t.vence) : (t.vence === hoy ? 'para hoy' : Fecha.relativa(t.vence));
    const meta = puntoMateria(materia) + '<span>' + esc(materia ? materia.nombre : 'Sin materia') + ' · ' + esc(etiquetaFecha) + '</span>' +
      (t.tipo === 'sesion' ? '<span class="chip-mini">Sesión de estudio</span>' : '') +
      (t.foto ? '<span class="chip-mini">Foto</span>' : '');
    let casillero = '';
    if (op.modo !== 'lectura' && (t.estado === 'pendiente' || enviada)) {
      casillero = '<button type="button" class="casillero' + (enviada ? ' marcado' : '') + '" data-accion="' + (enviada ? 'desmarcar' : 'marcar') + '" data-id="' + t.id + '" aria-label="' +
        esc((enviada ? 'Desmarcar: ' : 'Marcar como hecha: ') + t.titulo) + '">' + (enviada ? icono('check', 20, 3) : '') + '</button>';
    }
    return '<div class="fila-tarea' + (vencida ? ' vencida' : '') + (enviada ? ' enviada' : '') + '">' +
      '<button type="button" class="fila-cuerpo" data-accion="ir" data-pantalla="tarea" data-id="' + t.id + '">' +
      '<span class="meta">' + meta + '</span>' +
      '<span class="fila-titulo">' + esc(t.titulo) + '</span>' +
      (enviada ? '<span class="aviso-ok">Falta que papá la valide</span>' : '') +
      (t.nota && t.estado === 'pendiente' ? '<span class="aviso-nota">Papá: ' + esc(t.nota) + '</span>' : '') +
      '</button>' + casillero + '</div>';
  }

  function barra(pct, color, etiqueta) {
    return '<div class="barra-progreso" role="progressbar" aria-label="' + esc(etiqueta || '') + '" aria-valuenow="' + Math.round(pct) + '" aria-valuemin="0" aria-valuemax="100">' +
      '<div style="width:' + util.limitar(pct, 0, 100) + '%;background:' + color + '"></div></div>';
  }

  /** Barra de vida en segmentos (corazones pixelados). */
  function vida(valor, max, chico) {
    const t = chico ? 12 : 18;
    let html = '<span class="vida' + (chico ? ' chica' : '') + '" role="img" aria-label="Vida: ' + valor + ' de ' + max + '">';
    for (let i = 0; i < max; i++) {
      const lleno = i < valor;
      const c = lleno ? (valor <= 2 ? '#FF7A6B' : '#FF5E7E') : '#33384C';
      html += '<svg width="' + t + '" height="' + t + '" viewBox="0 0 7 6" shape-rendering="crispEdges" aria-hidden="true">' +
        '<rect x="1" y="0" width="2" height="1" fill="' + c + '"/><rect x="4" y="0" width="2" height="1" fill="' + c + '"/>' +
        '<rect x="0" y="1" width="7" height="2" fill="' + c + '"/><rect x="1" y="3" width="5" height="1" fill="' + c + '"/>' +
        '<rect x="2" y="4" width="3" height="1" fill="' + c + '"/><rect x="3" y="5" width="1" height="1" fill="' + c + '"/>' +
        (lleno ? '<rect x="1" y="1" width="1" height="1" fill="#FFC2CF"/>' : '') + '</svg>';
    }
    return html + '</span>';
  }

  function vacio(texto, boton) {
    return '<div class="vacio"><p>' + texto + '</p>' + (boton || '') + '</div>';
  }

  AQ.ui = { icono, moneda, botonAjustes, encabezado, navEstudiante, puntoMateria, filaTarea, barra, vida, vacio };
})(globalThis.AQ = globalThis.AQ || {});
