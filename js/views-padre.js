/*
 * views-padre.js — PIN, panel del padre y ajustes.
 */
(function (AQ) {
  'use strict';

  const { Fecha, util, reglas, ui } = AQ;
  const esc = util.esc;
  const V = AQ.vistas = AQ.vistas || {};

  V.pin = function (app) {
    return '<main class="pantalla centrada">' +
      ui.encabezado('Panel del padre', 'perfiles') +
      '<form class="tarjeta formulario" data-form="pin">' +
      '<div class="centro">' + ui.icono('candado', 36) + '</div>' +
      '<label for="pin">Ingresá el PIN</label>' +
      '<input id="pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="current-password" required autofocus>' +
      (app.params.error ? '<p class="texto-error" role="alert">PIN incorrecto. Probá de nuevo.</p>' : '') +
      '<button class="boton primario ancho" type="submit">Entrar</button>' +
      '</form></main>';
  };

  function kpi(titulo, valor, detalle, clase) {
    return '<div class="kpi"><span class="texto-chico">' + titulo + '</span><span class="kpi-valor ' + (clase || '') + '">' + valor + '</span>' +
      (detalle ? '<span class="texto-chico">' + detalle + '</span>' : '') + '</div>';
  }

  V.padre = function (app) {
    const s = app.store;
    const perfiles = s.perfiles;
    const barraSup = '<header class="barra padre-barra">' +
      '<div class="logo chico">' + ui.moneda(22) + '<span class="titulo-pixel">Panel del padre</span></div>' +
      '<div class="barra-extra">' +
      '<button type="button" class="boton secundario chico" data-accion="ir" data-pantalla="padre-ajustes">' + ui.icono('ajustes', 18) + 'Ajustes</button>' +
      '<button type="button" class="boton secundario chico" data-accion="salir-padre">' + ui.icono('salir', 18) + 'Salir</button>' +
      '</div></header>';

    if (!perfiles.length) {
      return '<main class="pantalla ancha">' + barraSup +
        ui.vacio('Todavía no hay perfiles.', '<button type="button" class="boton primario" data-accion="ir" data-pantalla="perfil-form">Crear perfil</button>') + '</main>';
    }
    if (!s.perfil(app.perfilId)) app.perfilId = perfiles[0].id;
    const p = s.perfil(app.perfilId);
    const hoy = Fecha.hoy();

    const pestanas = '<div class="pestanas" role="tablist">' + perfiles.map((x) => {
      const n = s.resumen(x.id).porAprobar;
      return '<button type="button" role="tab" class="pestana' + (x.id === p.id ? ' activa' : '') + '" aria-selected="' + (x.id === p.id) + '" data-accion="elegir-perfil-padre" data-id="' + x.id + '">' +
        esc(x.nombre) + (n ? '<span class="burbuja">' + n + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    const r = s.resumen(p.id);
    const aTiempo = s.aTiempo(p.id, 30);
    const racha = s.rachaRevision(p.id);
    const revisoHoy = p.revision.ultima === hoy;

    // Para aprobar
    const enviadas = s.tareasDe(p.id).filter((t) => t.estado === 'enviada').sort((a, b) => a.vence.localeCompare(b.vence));
    const aprobar = enviadas.map((t) => {
      const m = s.materia(t.materiaId);
      let monto = reglas.MONEDAS.A_TIEMPO;
      let cuando = 'a tiempo';
      if (t.tipo === 'sesion') { monto = reglas.MONEDAS.SESION; cuando = 'sesión de estudio'; }
      else if (Fecha.diferencia(t.enviadaEl, t.vence) < 0) { monto = reglas.MONEDAS.TARDE; cuando = 'hecha tarde'; }
      const devolviendo = app.devolviendo === t.id;
      return '<div class="item-aprobar">' +
        '<button type="button" class="fila-cuerpo" data-accion="ir" data-pantalla="tarea" data-id="' + t.id + '">' +
        '<span class="meta">' + ui.puntoMateria(m) + esc(m ? m.nombre : '') + ' · vence ' + esc(Fecha.relativa(t.vence)) + ' · ' + cuando + (t.foto ? ' · con foto' : '') + '</span>' +
        '<span class="fila-titulo">' + esc(t.titulo) + '</span></button>' +
        (devolviendo
          ? '<form class="form-devolver" data-form="devolver" data-id="' + t.id + '"><label for="nota-' + t.id + '">Nota para ' + esc(p.nombre) + '</label>' +
            '<input id="nota-' + t.id + '" name="nota" type="text" maxlength="200" placeholder="Ej.: falta el ejercicio 4" autofocus>' +
            '<div class="fila-botones"><button type="button" class="boton secundario chico" data-accion="cancelar-devolver">Cancelar</button><button class="boton primario chico" type="submit">Devolver</button></div></form>'
          : '<div class="fila-botones"><button type="button" class="boton secundario chico" data-accion="devolver" data-id="' + t.id + '">Devolver con nota</button>' +
            '<button type="button" class="boton primario chico" data-accion="aprobar" data-id="' + t.id + '">Aprobar · +' + monto + '</button></div>') +
        '</div>';
    }).join('');

    // Canjes
    const canjes = s.canjesDe(p.id).filter((c) => !c.entregado);
    const listaCanjes = canjes.map((c) =>
      '<li><span class="lista-texto"><b>' + esc(c.nombre) + '</b><small>Canjeado ' + esc(Fecha.relativa(c.fecha)) + ' · ' + c.precio + ' monedas</small></span>' +
      '<span class="fila-botones"><button type="button" class="boton secundario chico" data-accion="cancelar-canje" data-id="' + c.id + '">Cancelar</button>' +
      '<button type="button" class="boton primario chico" data-accion="entregado" data-id="' + c.id + '">Entregado</button></span></li>').join('');

    // Pendientes
    const pendientes = s.tareasDe(p.id).filter((t) => t.estado === 'pendiente').sort((a, b) => a.vence.localeCompare(b.vence));
    const listaPend = pendientes.slice(0, 20).map((t) => {
      const m = s.materia(t.materiaId);
      const vencida = t.vence < hoy;
      return '<li class="' + (vencida ? 'vencida' : '') + '"><button type="button" class="lista-texto boton-texto" data-accion="ir" data-pantalla="tarea" data-id="' + t.id + '">' +
        '<b>' + esc(t.titulo) + '</b><small>' + ui.puntoMateria(m) + esc(m ? m.nombre : '') + ' · ' + (vencida ? 'venció ' : '') + esc(Fecha.relativa(t.vence)) +
        (t.tipo === 'sesion' ? ' · sesión' : '') + (t.creadaPor === 'padre' ? ' · la cargaste vos' : '') + '</small></button>' +
        '<button type="button" class="boton-icono" data-accion="borrar-tarea" data-id="' + t.id + '" aria-label="Borrar ' + esc(t.titulo) + '">' + ui.icono('basura', 18) + '</button></li>';
    }).join('');

    // Por materia
    const porMateria = s.materiasDe(p.id).map((m) => ({ m, dato: s.aTiempo(p.id, 30, m.id) })).filter((x) => x.dato);
    const barrasMateria = porMateria.map(({ m, dato }) => {
      const bajo = dato.pct < 70;
      return '<div class="fila-barra"><span>' + esc(m.nombre) + '</span>' + ui.barra(dato.pct, bajo ? '#FFB547' : '#7BE0A8', m.nombre) +
        '<b class="' + (bajo ? 'alerta' : '') + '">' + dato.pct + '%</b><small>' + dato.ok + '/' + dato.total + '</small></div>';
    }).join('');

    // Exámenes
    const examenes = s.examenesDe(p.id);
    const proximos = examenes.filter((x) => x.fecha >= hoy).slice(0, 5);
    const conNota = examenes.filter((x) => x.fecha < hoy).reverse().slice(0, 5);
    const filaEx = (x) => {
      const m = s.materia(x.materiaId);
      const ses = s.sesionesDe(x.id);
      const hechas = ses.filter((t) => t.estado !== 'pendiente').length;
      return '<button type="button" class="fila-examen" data-accion="ir" data-pantalla="examen" data-id="' + x.id + '">' +
        '<span class="fecha-bloque"><small>' + Fecha.diaCorto(x.fecha) + '</small><b>' + Fecha.numeroDia(x.fecha) + '</b></span>' +
        '<span class="fila-examen-texto"><span class="fila-titulo">' + ui.puntoMateria(m) + esc(m ? m.nombre : '') + (x.temas ? ': ' + esc(x.temas) : '') + '</span>' +
        '<span class="texto-chico">' + (x.fecha >= hoy ? 'Sesiones de estudio: ' + hechas + ' de ' + ses.length : (x.nota ? 'Nota: ' + esc(x.nota) : 'Sin nota cargada')) + '</span></span></button>';
    };

    const movs = s.movimientosDe(p.id).slice(-10).reverse();

    return '<main class="pantalla ancha">' + barraSup + pestanas +
      '<section class="tarjeta revision">' +
      '<div><h2 class="titulo-chico">Revisión diaria</h2><p class="texto-chico">Cinco minutos juntos: miren la lista y comparen con el cuaderno de comunicados o el grupo del curso. Cada 5 días seguidos, +' + reglas.MONEDAS.RACHA_REVISION + ' monedas.</p></div>' +
      '<div class="revision-accion"><span class="texto-chico">Racha: <b>' + racha + (racha === 1 ? ' día' : ' días') + '</b></span>' +
      (revisoHoy ? '<span class="chip-mini ok">Hoy ya la hicieron</span>' : '<button type="button" class="boton primario" data-accion="revision">Sí, hoy la revisamos</button>') +
      '</div></section>' +
      '<div class="kpis">' +
      kpi('A tiempo (últimos 30 días)', aTiempo ? aTiempo.pct + '%' : '—', aTiempo ? aTiempo.ok + ' de ' + aTiempo.total + (aTiempo.total === 1 ? ' tarea' : ' tareas') : 'Sin datos todavía', aTiempo && aTiempo.pct < 70 ? 'alerta' : 'ok') +
      kpi('Pendientes', r.pendientes, r.vencidas ? '<span class="mal">' + r.vencidas + (r.vencidas === 1 ? ' vencida' : ' vencidas') + '</span>' : 'ninguna vencida') +
      kpi('Para aprobar', r.porAprobar, '') +
      kpi('Monedas', s.saldo(p.id), 'Nivel ' + s.nivel(p.id), 'dorado') +
      '</div>' +
      '<div class="columnas">' +
      '<div class="columna">' +
      '<section class="tarjeta"><div class="fila-entre"><h2 class="titulo-chico">Para aprobar</h2><span class="texto-chico">' + (enviadas.length ? enviadas.length + (enviadas.length === 1 ? ' tarea' : ' tareas') : 'Nada por revisar') + '</span></div>' +
      (aprobar || '<p class="texto-suave">Cuando ' + esc(p.nombre) + ' marque tareas como hechas, aparecen acá.</p>') + '</section>' +
      (canjes.length ? '<section class="tarjeta"><h2 class="titulo-chico">Canjes por entregar</h2><ul class="lista-simple">' + listaCanjes + '</ul></section>' : '') +
      '<section class="tarjeta"><div class="fila-entre"><h2 class="titulo-chico">Tareas pendientes</h2>' +
      '<span class="fila-botones"><button type="button" class="boton secundario chico" data-accion="ir" data-pantalla="examen-form">+ Examen</button><button type="button" class="boton secundario chico" data-accion="ir" data-pantalla="tarea-form">+ Tarea</button></span></div>' +
      (listaPend ? '<ul class="lista-simple">' + listaPend + '</ul>' : '<p class="texto-suave">No hay tareas pendientes.</p>') + '</section>' +
      '</div>' +
      '<div class="columna">' +
      '<section class="tarjeta"><h2 class="titulo-chico">A tiempo por materia (30 días)</h2>' +
      (barrasMateria ? barrasMateria + '<p class="texto-chico">En naranja, las materias por debajo del 70%.</p>' : '<p class="texto-suave">Aparece cuando haya tareas vencidas en el período.</p>') + '</section>' +
      (function () {
        const m = s.mascota(p.id);
        if (m.etapa === 'huevo') return '';
        return '<section class="tarjeta"><div class="fila-entre"><h2 class="titulo-chico">Mascota: ' + esc(m.nombre) + '</h2>' + ui.vida(m.vida, reglas.VIDA.MAX) + '</div>' +
          '<p class="texto-chico">' + (m.comioHoy ? 'Hoy ya comió.' : 'Hoy todavía no comió.') + ' Come una vez por día (' + reglas.VIDA.COSTO_COMIDA + ' monedas) y pierde 1 de vida por cada día sin comer. Nunca se muere.</p>' +
          '<div class="fila-entre"><span class="texto-chico">' + (m.vacaciones ? '<b class="ok">Modo vacaciones activo:</b> no pierde vida.' : 'Para feriados largos o vacaciones, pausá el hambre.') + '</span>' +
          '<button type="button" class="boton secundario chico" data-accion="vacaciones" data-valor="' + (m.vacaciones ? '0' : '1') + '">' + (m.vacaciones ? 'Terminar vacaciones' : 'Modo vacaciones') + '</button></div></section>';
      })() +
      (function () {
        const e7 = s.estudio(p.id, 7);
        const e1 = s.estudio(p.id, 1);
        return '<section class="tarjeta"><h2 class="titulo-chico">Pomodoro</h2>' +
          '<div class="dos-datos"><div><span class="kpi-valor">' + e1.pomodoros + '</span><span class="texto-chico">hoy · ' + e1.minutos + ' min</span></div>' +
          '<div><span class="kpi-valor">' + e7.pomodoros + '</span><span class="texto-chico">últimos 7 días · ' + e7.minutos + ' min</span></div></div>' +
          '<p class="texto-chico">Da 1 moneda cada 5 minutos, hasta ' + reglas.MONEDAS.TOPE_POMODORO_DIA + ' por día. No se aprueba: la app no puede saber si estudió de verdad, así que conviene mirarlo de vez en cuando.</p></section>';
      })() +
      '<section class="tarjeta"><h2 class="titulo-chico">Próximos exámenes</h2>' + (proximos.length ? proximos.map(filaEx).join('') : '<p class="texto-suave">No hay exámenes agendados.</p>') +
      (conNota.length ? '<h3 class="titulo-chico">Anteriores</h3>' + conNota.map(filaEx).join('') : '') + '</section>' +
      '<section class="tarjeta"><h2 class="titulo-chico">Últimos movimientos de monedas</h2>' +
      (movs.length ? '<ul class="lista-movs">' + movs.map((mv) =>
        '<li><span>' + esc(mv.motivo) + '<small>' + esc(Fecha.relativa(mv.fecha)) + '</small></span><b class="' + (mv.cantidad >= 0 ? 'ok' : 'mal') + '">' + (mv.cantidad > 0 ? '+' : '') + mv.cantidad + '</b></li>').join('') + '</ul>'
        : '<p class="texto-suave">Sin movimientos todavía.</p>') + '</section>' +
      '</div></div></main>';
  };

  V['padre-ajustes'] = function (app) {
    const s = app.store;
    const kb = Math.round(s.tamanioDatos() / 1024);
    const perfiles = s.perfiles.map((p) =>
      '<li><span class="lista-texto"><b>' + esc(p.nombre) + '</b><small>' + (p.anio ? esc(p.anio) + ' · ' : '') + 'mascota: ' + esc(p.mascota.nombre) + '</small></span>' +
      '<button type="button" class="boton-icono" data-accion="ir" data-pantalla="perfil-form" data-id="' + p.id + '" aria-label="Editar ' + esc(p.nombre) + '">' + ui.icono('lapiz', 18) + '</button></li>').join('');
    const premios = s.premios.map((pr) =>
      '<li><span class="lista-texto"><b>' + esc(pr.nombre) + '</b><small class="monedas-chico">' + ui.moneda(12) + pr.precio + '</small></span>' +
      '<button type="button" class="boton-icono" data-accion="ir" data-pantalla="premio-form" data-id="' + pr.id + '" aria-label="Editar ' + esc(pr.nombre) + '">' + ui.icono('lapiz', 18) + '</button></li>').join('');

    return '<main class="pantalla ancha">' + ui.encabezado('Ajustes', 'padre') +
      '<div class="columnas"><div class="columna">' +
      '<section class="tarjeta"><div class="fila-entre"><h2 class="titulo-chico">Perfiles</h2><button type="button" class="boton secundario chico" data-accion="ir" data-pantalla="perfil-form">+ Perfil</button></div>' +
      (perfiles ? '<ul class="lista-simple">' + perfiles + '</ul>' : '<p class="texto-suave">Sin perfiles.</p>') + '</section>' +
      '<section class="tarjeta"><div class="fila-entre"><h2 class="titulo-chico">Tienda de premios</h2><button type="button" class="boton secundario chico" data-accion="ir" data-pantalla="premio-form">+ Premio</button></div>' +
      '<p class="texto-chico">Premios reales que tus hijos pueden canjear con monedas. Como referencia: una tarea a tiempo da ' + (reglas.MONEDAS.ANOTAR + reglas.MONEDAS.A_TIEMPO) + ' monedas contando la anotación.</p>' +
      (premios ? '<ul class="lista-simple">' + premios + '</ul>' : '<p class="texto-suave">Todavía no cargaste premios.</p>') + '</section>' +
      '</div><div class="columna">' +
      '<section class="tarjeta"><h2 class="titulo-chico">Cambiar PIN</h2><form class="formulario" data-form="cambiar-pin">' +
      '<label for="pin-actual">PIN actual</label><input id="pin-actual" name="actual" type="password" inputmode="numeric" maxlength="4" required>' +
      '<label for="pin-nuevo">PIN nuevo (4 números)</label><input id="pin-nuevo" name="nuevo" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required>' +
      '<button class="boton primario" type="submit">Cambiar PIN</button></form></section>' +
      '<section class="tarjeta"><h2 class="titulo-chico">Datos y copia de seguridad</h2>' +
      '<p class="texto-chico">Todo se guarda en este navegador (' + kb + ' KB usados). Si se borran los datos del navegador, se pierde. Descargá una copia cada tanto.</p>' +
      '<div class="acciones">' +
      '<button type="button" class="boton primario ancho" data-accion="exportar">Descargar copia de seguridad</button>' +
      '<button type="button" class="boton secundario ancho" data-accion="copiar-copia">Copiar copia como texto</button>' +
      '<button type="button" class="boton secundario ancho" data-accion="importar">Importar copia desde archivo</button>' +
      '<button type="button" class="boton secundario ancho" data-accion="pegar-copia">Pegar copia como texto</button>' +
      '<input type="file" id="archivo-importar" accept="application/json,.json" hidden data-cambio="importar">' +
      '<button type="button" class="boton secundario ancho" data-accion="borrar-fotos">Borrar fotos de tareas aprobadas</button>' +
      '<button type="button" class="boton peligro ancho" data-accion="borrar-todo">Borrar todos los datos</button>' +
      '</div></section>' +
      '</div></div></main>';
  };

  V['perfil-form'] = function (app) {
    const s = app.store;
    const p = app.params.id ? s.perfil(app.params.id) : null;
    const primero = s.perfiles.length === 0;
    return '<main class="pantalla">' + ui.encabezado(p ? 'Editar perfil' : 'Nuevo perfil', primero ? null : (app.params.volver || 'padre-ajustes')) +
      (primero ? '<p class="texto-suave">Creá el perfil de tu hijo o hija. Después podés agregar más.</p>' : '') +
      '<form class="formulario" data-form="perfil">' +
      '<label for="nombre">Nombre</label><input id="nombre" name="nombre" type="text" maxlength="40" required value="' + esc(p ? p.nombre : '') + '">' +
      '<label for="anio">Año que cursa (opcional)</label><input id="anio" name="anio" type="text" maxlength="20" placeholder="Ej.: 1.º año" value="' + esc(p ? p.anio : '') + '">' +
      '<label for="mascota">Nombre de la mascota</label><input id="mascota" name="mascota" type="text" maxlength="20" placeholder="Lo puede elegir el chico" value="' + esc(p ? p.mascota.nombre : '') + '">' +
      '<button class="boton primario ancho" type="submit">' + (p ? 'Guardar' : 'Crear perfil') + '</button></form>' +
      (p ? '<button type="button" class="boton peligro ancho" data-accion="borrar-perfil" data-id="' + p.id + '">' + ui.icono('basura', 18) + 'Borrar perfil y todos sus datos</button>' : '') +
      '</main>';
  };

  V['premio-form'] = function (app) {
    const s = app.store;
    const pr = app.params.id ? s.premios.find((x) => x.id === app.params.id) : null;
    const ideas = ['30 minutos más de consola', 'Elegir la cena del viernes', 'Invitar a un amigo a casa', 'Salida al cine'];
    return '<main class="pantalla">' + ui.encabezado(pr ? 'Editar premio' : 'Nuevo premio', 'padre-ajustes') +
      '<form class="formulario" data-form="premio">' +
      '<label for="nombre">Premio</label><input id="nombre" name="nombre" type="text" maxlength="60" required list="ideas-premios" value="' + esc(pr ? pr.nombre : '') + '">' +
      '<datalist id="ideas-premios">' + ideas.map((i) => '<option value="' + i + '"></option>').join('') + '</datalist>' +
      '<label for="precio">Precio en monedas</label><input id="precio" name="precio" type="number" min="1" step="1" required value="' + (pr ? pr.precio : '') + '">' +
      '<button class="boton primario ancho" type="submit">' + (pr ? 'Guardar' : 'Agregar premio') + '</button></form>' +
      (pr ? '<button type="button" class="boton peligro ancho" data-accion="borrar-premio" data-id="' + pr.id + '">' + ui.icono('basura', 18) + 'Borrar premio</button>' : '') +
      '</main>';
  };
})(globalThis.AQ = globalThis.AQ || {});
