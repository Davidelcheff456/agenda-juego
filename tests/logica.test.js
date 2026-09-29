/*
 * Pruebas de la lógica (sin navegador): node tests/logica.test.js
 */
'use strict';
const assert = require('assert');
require('../js/util.js');
require('../js/repository.js');
require('../js/rules.js');
require('../js/store.js');
require('../js/pomodoro.js');
const AQ = globalThis.AQ;
const { Fecha } = AQ;

let pasadas = 0;
function prueba(nombre, fn) {
  try { fn(); pasadas++; console.log('  ok  ' + nombre); }
  catch (e) { console.error('FALLA ' + nombre + '\n', e); process.exitCode = 1; }
}

function nuevoStore() {
  Fecha.fijar('2026-09-28'); // lunes
  const s = new AQ.Store(new AQ.MemoryRepository());
  s.configurarPin('1234');
  const p = s.agregarPerfil({ nombre: 'Tomi', anio: '1.º año', mascota: 'Brote' });
  const m = s.agregarMateria(p.id, { nombre: 'Matemática' });
  return { s, p, m };
}

prueba('fechas', () => {
  assert.strictEqual(Fecha.sumarDias('2026-09-28', 5), '2026-10-03');
  assert.strictEqual(Fecha.lunes('2026-10-04'), '2026-09-28');
  assert.strictEqual(Fecha.diferencia('2026-09-28', '2026-10-05'), 7);
  Fecha.fijar('2026-09-28');
  assert.strictEqual(Fecha.relativa('2026-09-29'), 'mañana');
  assert.strictEqual(Fecha.larga('2026-09-28'), 'lunes 28 de septiembre');
});

prueba('PIN', () => {
  const { s } = nuevoStore();
  assert.ok(s.verificarPin('1234'));
  assert.ok(!s.verificarPin('0000'));
  assert.throws(() => s.configurarPin('12a4'), AQ.ErrorValidacion);
});

prueba('anotar +5, marcar hecha +3 y validar a tiempo +15', () => {
  const { s, p, m } = nuevoStore();
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'Ej. 1 a 5', vence: '2026-09-29' });
  assert.strictEqual(s.saldo(p.id), 5);
  assert.strictEqual(s.marcarHecha(t.id), 3);
  assert.strictEqual(s.saldo(p.id), 8);
  assert.strictEqual(s.aprobar(t.id), 15);
  assert.strictEqual(s.saldo(p.id), 23);
});

prueba('marcar hecha da monedas una sola vez por tarea', () => {
  const { s, p, m } = nuevoStore();
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  s.marcarHecha(t.id);
  s.desmarcar(t.id);
  assert.strictEqual(s.marcarHecha(t.id), 0);
  s.devolver(t.id, 'falta algo');
  assert.strictEqual(s.marcarHecha(t.id), 0);
  assert.strictEqual(s.saldo(p.id), 8);
});

prueba('tarea del padre no da +5', () => {
  const { s, p, m } = nuevoStore();
  s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' }, true);
  assert.strictEqual(s.saldo(p.id), 0);
});

prueba('terminar tarde da +5', () => {
  const { s, p, m } = nuevoStore();
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  Fecha.fijar('2026-09-30');
  s.marcarHecha(t.id);
  assert.strictEqual(s.aprobar(t.id), 5);
});

prueba('devolver vuelve a pendiente con nota, sin monedas', () => {
  const { s, p, m } = nuevoStore();
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  s.marcarHecha(t.id);
  s.devolver(t.id, 'Falta el punto 3');
  assert.strictEqual(s.tarea(t.id).estado, 'pendiente');
  assert.strictEqual(s.tarea(t.id).nota, 'Falta el punto 3');
  assert.strictEqual(s.saldo(p.id), 8); // conserva lo de anotar y marcar, no suma lo de validar
});

prueba('borrar tarea descuenta lo que dio y no suma xp', () => {
  const { s, p, m } = nuevoStore();
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  s.marcarHecha(t.id);
  assert.strictEqual(s.monedasDeTarea(t.id), 8);
  s.desmarcar(t.id);
  s.eliminarTarea(t.id);
  assert.strictEqual(s.saldo(p.id), 0);
  assert.strictEqual(s.xp(p.id), 0);
});

prueba('no se puede aprobar sin marcar', () => {
  const { s, p, m } = nuevoStore();
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  assert.throws(() => s.aprobar(t.id), AQ.ErrorValidacion);
});

prueba('plan de estudio: 4 sesiones en los 5 días previos', () => {
  const plan = new AQ.PlanEspaciado();
  const ses = plan.generar('2026-10-05', '2026-09-28');
  assert.deepStrictEqual(ses.map((x) => x.fecha), ['2026-09-30', '2026-10-01', '2026-10-03', '2026-10-04']);
  assert.strictEqual(plan.generar('2026-09-30', '2026-09-28').length, 2);
  assert.strictEqual(plan.generar('2026-09-29', '2026-09-28').length, 1);
  assert.strictEqual(plan.generar('2026-09-28', '2026-09-28').length, 0);
});

prueba('examen crea sesiones que dan +10', () => {
  const { s, p, m } = nuevoStore();
  const x = s.agregarExamen(p.id, { materiaId: m.id, fecha: '2026-10-05', temas: 'Ecuaciones' });
  const ses = s.sesionesDe(x.id);
  assert.strictEqual(ses.length, 4);
  Fecha.fijar('2026-09-30');
  s.marcarHecha(ses[0].id);
  assert.strictEqual(s.aprobar(ses[0].id), 10);
  s.eliminarExamen(x.id);
  assert.strictEqual(s.sesionesDe(x.id).length, 1); // la aprobada queda en el historial
});

/** Valida 3 tareas para que la mascota salga del huevo. Da 3 × (5 + 3 + 15) = 69 monedas. */
function hacerNacer(s, p, m) {
  for (let i = 0; i < 3; i++) {
    const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'Nacer ' + i, vence: '2026-12-31' });
    s.marcarHecha(t.id);
    s.aprobar(t.id);
  }
}

prueba('huevo: nace recién con 3 tareas validadas', () => {
  const { s, p, m } = nuevoStore();
  const ts = [0, 1, 2].map((i) => s.agregarTarea(p.id, { materiaId: m.id, titulo: 'T' + i, vence: '2026-10-20' }));
  ts.forEach((t) => s.marcarHecha(t.id));
  assert.strictEqual(s.mascota(p.id).etapa, 'huevo');       // anotadas y marcadas no alcanzan
  s.aprobar(ts[0].id); s.aprobar(ts[1].id);
  assert.strictEqual(s.mascota(p.id).etapa, 'huevo');
  assert.strictEqual(s.mascota(p.id).validadas, 2);
  assert.ok(s.saldo(p.id) > 0);                              // las monedas se juntan igual
  assert.throws(() => s.alimentar(p.id), AQ.ErrorValidacion); // un huevo no come
  assert.ok(!s.nacimientoPendiente(p.id));
  s.aprobar(ts[2].id);
  assert.strictEqual(s.mascota(p.id).etapa, 'bebe');
  assert.ok(s.nacimientoPendiente(p.id));
  assert.strictEqual(s.perfil(p.id).mascota.nacioEl, '2026-09-28');
  s.marcarNacimientoVisto(p.id);
  assert.ok(!s.nacimientoPendiente(p.id));
});

prueba('huevo: las sesiones de estudio no cuentan para nacer', () => {
  const { s, p, m } = nuevoStore();
  const x = s.agregarExamen(p.id, { materiaId: m.id, fecha: '2026-10-05' });
  Fecha.fijar('2026-10-04');
  s.sesionesDe(x.id).forEach((t) => { s.marcarHecha(t.id); s.aprobar(t.id); });
  assert.strictEqual(s.mascota(p.id).etapa, 'huevo');
});

prueba('mascota: estados por prioridad', () => {
  const { s, p, m } = nuevoStore();
  hacerNacer(s, p, m);
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  assert.strictEqual(s.mascota(p.id).estado, 'hambriento'); // no comió hoy
  s.alimentar(p.id);
  assert.strictEqual(s.mascota(p.id).estado, 'preocupado'); // algo para mañana
  Fecha.fijar('2026-10-01');
  s.actualizarVida(p.id);
  assert.strictEqual(s.perfil(p.id).vida.valor, 3);         // no comió el 29 ni el 30
  assert.strictEqual(s.mascota(p.id).estado, 'triste');      // la tarea del 29 venció
});

prueba('mascota: triste con tarea vencida', () => {
  const { s, p, m } = nuevoStore();
  hacerNacer(s, p, m);
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  Fecha.fijar('2026-09-30');
  s.actualizarVida(p.id);                                     // no comió el 29: vida 4
  s.alimentar(p.id);
  assert.strictEqual(s.mascota(p.id).estado, 'triste');
  s.marcarHecha(t.id);
  assert.strictEqual(s.mascota(p.id).estado, 'tranquilo');
});

prueba('vida: pierde 1 por día sin comer, nunca baja de 0', () => {
  const { s, p, m } = nuevoStore();   // lunes 28
  hacerNacer(s, p, m);                // nace el 28 con 69 monedas
  s.alimentar(p.id);                  // come el 28
  assert.strictEqual(s.saldo(p.id), 64);
  assert.throws(() => s.alimentar(p.id), AQ.ErrorValidacion); // una vez por día
  Fecha.fijar('2026-10-02');          // no entró el 29, 30 ni 1
  assert.strictEqual(s.actualizarVida(p.id), 3);
  assert.strictEqual(s.perfil(p.id).vida.valor, 2);
  assert.strictEqual(s.mascota(p.id).estado, 'debil');
  assert.strictEqual(s.actualizarVida(p.id), 0); // no descuenta dos veces
  Fecha.fijar('2026-10-10');
  s.actualizarVida(p.id);
  assert.strictEqual(s.perfil(p.id).vida.valor, 0);
});

prueba('vida: el huevo no pierde vida y comer recupera', () => {
  const { s, p, m } = nuevoStore();
  Fecha.fijar('2026-10-05');
  assert.strictEqual(s.actualizarVida(p.id), 0); // todavía huevo
  assert.strictEqual(s.perfil(p.id).vida.valor, 5);
  hacerNacer(s, p, m);                            // nace el 5
  Fecha.fijar('2026-10-08');
  assert.strictEqual(s.actualizarVida(p.id), 2);  // días 6 y 7 sin comer
  assert.strictEqual(s.alimentar(p.id), 1);
  assert.strictEqual(s.perfil(p.id).vida.valor, 4);
  const movs = s.movimientosDe(p.id);
  assert.strictEqual(movs[movs.length - 1].cantidad, -5);
  assert.strictEqual(s.xp(p.id), 69);             // la comida no resta experiencia
});

prueba('vida: modo vacaciones pausa el hambre', () => {
  const { s, p, m } = nuevoStore();
  hacerNacer(s, p, m);
  s.ponerVacaciones(p.id, true);
  Fecha.fijar('2026-10-20');
  assert.strictEqual(s.actualizarVida(p.id), 0);
  assert.strictEqual(s.mascota(p.id).estado === 'hambriento', false);
  s.ponerVacaciones(p.id, false);
  Fecha.fijar('2026-10-22');
  assert.strictEqual(s.actualizarVida(p.id), 1); // solo el 21 cuenta
});

prueba('canje descuenta y cancelar reintegra', () => {
  const { s, p, m } = nuevoStore();
  const premio = s.agregarPremio({ nombre: 'Consola', precio: 13 });
  assert.throws(() => s.canjear(p.id, premio.id), AQ.ErrorValidacion);
  const t = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  s.marcarHecha(t.id); s.aprobar(t.id);
  const c = s.canjear(p.id, premio.id);
  assert.strictEqual(s.saldo(p.id), 10);
  const xpAntes = s.xp(p.id);
  s.cancelarCanje(c.id);
  assert.strictEqual(s.saldo(p.id), 23);
  assert.strictEqual(s.xp(p.id), xpAntes);
});

prueba('cosméticos', () => {
  const { s, p, m } = nuevoStore();
  assert.throws(() => s.comprarCosmetico(p.id, 'colores', 'celeste'), AQ.ErrorValidacion);
  for (let i = 0; i < 16; i++) s.agregarTarea(p.id, { materiaId: m.id, titulo: 'T' + i, vence: '2026-09-29' });
  s.comprarCosmetico(p.id, 'colores', 'celeste');
  assert.strictEqual(s.perfil(p.id).mascota.color, 'celeste');
  s.equipar(p.id, 'colores', 'lima');
  assert.strictEqual(s.perfil(p.id).mascota.color, 'lima');
});

prueba('revisión diaria: bono a los 5 días', () => {
  const { s, p } = nuevoStore();
  let r;
  for (let i = 0; i < 5; i++) { Fecha.fijar(Fecha.sumarDias('2026-09-28', i)); r = s.registrarRevision(p.id); }
  assert.strictEqual(r.racha, 5);
  assert.strictEqual(r.bono, 20);
  assert.throws(() => s.registrarRevision(p.id), AQ.ErrorValidacion);
  Fecha.fijar('2026-10-05');
  assert.strictEqual(s.registrarRevision(p.id).racha, 1);
});

prueba('bono de semana limpia', () => {
  const { s, p, m } = nuevoStore(); // creado lunes 28/9
  const t1 = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'A', vence: '2026-09-30' });
  s.agregarTarea(p.id, { materiaId: m.id, titulo: 'B', vence: '2026-10-07' }); // semana siguiente, sin hacer
  s.marcarHecha(t1.id);
  Fecha.fijar('2026-10-06');
  assert.strictEqual(s.evaluarSemanas(p.id), 30);
  assert.strictEqual(s.evaluarSemanas(p.id), 0); // no se repite
  Fecha.fijar('2026-10-13');
  assert.strictEqual(s.evaluarSemanas(p.id), 0); // la tarea B venció sin hacerse
});

prueba('a tiempo por período', () => {
  const { s, p, m } = nuevoStore();
  const a = s.agregarTarea(p.id, { materiaId: m.id, titulo: 'A', vence: '2026-09-29' });
  s.agregarTarea(p.id, { materiaId: m.id, titulo: 'B', vence: '2026-09-29' });
  s.marcarHecha(a.id);
  Fecha.fijar('2026-10-01');
  assert.deepStrictEqual(s.aTiempo(p.id, 30), { pct: 50, total: 2, ok: 1 });
});

prueba('si guardar falla, el cambio se deshace', () => {
  const { s, p, m } = nuevoStore();
  s.repo.guardar = () => { throw new AQ.ErrorAlmacenamiento('lleno'); };
  assert.throws(() => s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' }));
  assert.strictEqual(s.tareasDe(p.id).length, 0);
  assert.strictEqual(s.saldo(p.id), 0);
});

prueba('exportar e importar', () => {
  const { s, p } = nuevoStore();
  const copia = s.exportar();
  s.borrarTodo();
  assert.strictEqual(s.perfiles.length, 0);
  s.importar(copia);
  assert.strictEqual(s.perfil(p.id).nombre, 'Tomi');
  assert.throws(() => s.importar('{"hola":1}'), AQ.ErrorValidacion);
});

prueba('borrar perfil borra todo lo suyo', () => {
  const { s, p, m } = nuevoStore();
  s.agregarTarea(p.id, { materiaId: m.id, titulo: 'X', vence: '2026-09-29' });
  s.eliminarPerfil(p.id);
  assert.strictEqual(s.estado.tareas.length + s.estado.materias.length + s.estado.movimientos.length, 0);
});

prueba('pomodoro: monedas por minutos y tope diario', () => {
  const { s, p } = nuevoStore();
  assert.strictEqual(s.registrarPomodoro(p.id, 25), 5);
  assert.strictEqual(s.registrarPomodoro(p.id, 15), 3);
  assert.strictEqual(s.registrarPomodoro(p.id, 30), 6);
  for (let i = 0; i < 3; i++) s.registrarPomodoro(p.id, 30); // 14 + 18 = 32 -> tope 30
  assert.strictEqual(s.monedasPomodoroHoy(p.id), 30);
  assert.strictEqual(s.registrarPomodoro(p.id, 25), 0);
  assert.deepStrictEqual(s.estudio(p.id, 1), { pomodoros: 7, minutos: 185 });
  Fecha.fijar('2026-09-29');
  assert.strictEqual(s.registrarPomodoro(p.id, 20), 4); // nuevo día, tope nuevo
});

prueba('temporizador: foco, descanso, pausa y reanudar', () => {
  let ahora = 0;
  const T = new AQ.Temporizador(null, () => ahora);
  assert.throws(() => T.iniciar('x', 17, 5), AQ.ErrorValidacion);
  T.iniciar('x', 25, 5);
  assert.strictEqual(AQ.pomodoro.formatear(T.restante()), '25:00');
  ahora = 10 * 60000;
  assert.strictEqual(AQ.pomodoro.formatear(T.restante()), '15:00');
  T.pausar();
  ahora += 60 * 60000;                       // una hora en pausa no cuenta
  assert.strictEqual(T.tick(), null);
  assert.strictEqual(AQ.pomodoro.formatear(T.restante()), '15:00');
  T.reanudar();
  ahora += 15 * 60000;
  const ev = T.tick();
  assert.deepStrictEqual(ev, { tipo: 'foco-completo', perfilId: 'x', minutos: 25, tareaId: null });
  assert.strictEqual(T.estado.fase, 'descanso');
  assert.strictEqual(AQ.pomodoro.formatear(T.restante()), '05:00');
  ahora += 5 * 60000;
  assert.deepStrictEqual(T.tick(), { tipo: 'descanso-completo' });
  assert.strictEqual(T.estado.fase, 'listo');
  T.otro();
  assert.strictEqual(T.estado.fase, 'foco');
  assert.strictEqual(T.estado.completados, 1);
  T.terminar();
  assert.ok(!T.activo);
});

prueba('temporizador: si la app estuvo cerrada, no se pierde el pomodoro', () => {
  let ahora = 0;
  const mem = {}; const alm = { getItem: (k) => mem[k] || null, setItem: (k, v) => { mem[k] = v; }, removeItem: (k) => { delete mem[k]; } };
  new AQ.Temporizador(alm, () => ahora).iniciar('x', 20, 10);
  ahora = 45 * 60000; // se cerró y volvió mucho después
  const T2 = new AQ.Temporizador(alm, () => ahora);
  assert.strictEqual(T2.tick().tipo, 'foco-completo');
  assert.strictEqual(T2.estado.fase, 'listo');
  assert.strictEqual(T2.tick(), null);
});

prueba('formato del reloj redondea hacia arriba', () => {
  assert.strictEqual(AQ.pomodoro.formatear(1), '00:01');
  assert.strictEqual(AQ.pomodoro.formatear(59001), '01:00');
  assert.strictEqual(AQ.pomodoro.formatear(0), '00:00');
});

prueba('configuración del estudiante', () => {
  const { s, p } = nuevoStore();
  assert.deepStrictEqual(s.ajustes(p.id), { letra: 'normal', sonido: true, animaciones: true, foco: 25, descanso: 5 });
  s.editarAjustes(p.id, { letra: 'grande', sonido: false, foco: '30', descanso: '10' });
  assert.deepStrictEqual(s.ajustes(p.id), { letra: 'grande', sonido: false, animaciones: true, foco: 30, descanso: 10 });
  assert.throws(() => s.editarAjustes(p.id, { foco: 17 }), AQ.ErrorValidacion);
  assert.throws(() => s.editarAjustes(p.id, { letra: 'enorme' }), AQ.ErrorValidacion);
  s.renombrarMascota(p.id, '  Pixel ');
  assert.strictEqual(s.perfil(p.id).mascota.nombre, 'Pixel');
  assert.throws(() => s.renombrarMascota(p.id, '   '), AQ.ErrorValidacion);
  // una copia vieja sin ajustes se completa al importar
  const viejo = JSON.parse(s.exportar()); delete viejo.perfiles[0].ajustes;
  s.importar(JSON.stringify(viejo));
  assert.strictEqual(s.ajustes(p.id).letra, 'normal');
});

console.log('\n' + pasadas + ' pruebas pasadas');
