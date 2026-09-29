/*
 * rules.js — Reglas del juego, separadas de los datos y de las pantallas.
 * Si querés ajustar cuántas monedas da cada cosa, se cambia acá y nada más.
 */
(function (AQ) {
  'use strict';

  const { Fecha, util } = AQ;

  const MONEDAS = Object.freeze({
    ANOTAR: 5,            // el estudiante anota una tarea
    A_TIEMPO: 15,         // aprobada, marcada como hecha antes o el día del vencimiento
    TARDE: 5,             // aprobada, pero terminada después del vencimiento
    SESION: 10,           // sesión de estudio de examen aprobada
    RACHA_REVISION: 20,   // 5 días seguidos de revisión diaria con el padre
    SEMANA_LIMPIA: 30,    // una semana sin tareas vencidas
    POMODORO_POR_5_MIN: 1, // pomodoro completo: 1 moneda cada 5 minutos de foco (15 min = 3, 30 min = 6)
    TOPE_POMODORO_DIA: 30  // máximo de monedas por pomodoros en un día (evita dejar el reloj corriendo solo)
  });

  const XP_POR_NIVEL = 100;

  /** Vida de la mascota: 5 segmentos. Come una vez por día; cada día sin comer pierde 1. */
  const VIDA = Object.freeze({
    MAX: 5,
    COSTO_COMIDA: 5,  // monedas por comida
    DEBIL: 2          // con 2 segmentos o menos está débil
  });

  const COLORES_MATERIA = ['#6EC5FF', '#FF9ECF', '#F7A35C', '#7BE0A8', '#B79CFF', '#E8E07A', '#FF7A6B', '#5EE0D8', '#C6F25B', '#D9A6FF'];

  /** Cosméticos de la mascota: colores del cuerpo y fondos de la tarjeta. */
  const COSMETICOS = Object.freeze({
    colores: [
      { id: 'lima', nombre: 'Lima', precio: 0, cuerpo: '#C6F25B', triste: '#A3B56B' },
      { id: 'celeste', nombre: 'Celeste', precio: 80, cuerpo: '#7FD4FF', triste: '#7FA3B8' },
      { id: 'rosa', nombre: 'Rosa chicle', precio: 80, cuerpo: '#FF9ECF', triste: '#B88AA2' },
      { id: 'lava', nombre: 'Lava', precio: 150, cuerpo: '#FF8A5B', triste: '#B87F66' },
      { id: 'oro', nombre: 'Dorado', precio: 300, cuerpo: '#FFD35C', triste: '#B8A366' }
    ],
    fondos: [
      { id: 'ninguno', nombre: 'Liso', precio: 0, css: '#1C1F2B' },
      { id: 'noche', nombre: 'Noche estrellada', precio: 120, css: 'radial-gradient(circle at 80% 20%, #3B4A7A 0 6%, transparent 7%), #1A2233' },
      { id: 'pasto', nombre: 'Pasto', precio: 120, css: 'linear-gradient(#1C2B22 70%, #2F5A34 70%)' },
      { id: 'atardecer', nombre: 'Atardecer', precio: 200, css: 'linear-gradient(#3A2340, #6B3A3A 70%, #2A1E2A 70%)' }
    ]
  });

  function color(id) { return COSMETICOS.colores.find((c) => c.id === id) || COSMETICOS.colores[0]; }
  function fondo(id) { return COSMETICOS.fondos.find((f) => f.id === id) || COSMETICOS.fondos[0]; }

  function nivelDesdeXp(xp) { return 1 + Math.floor(xp / XP_POR_NIVEL); }

  /** Etapa de la mascota: huevo hasta anotar la primera tarea; después según el nivel. */
  function etapa(nivel, tieneTareas) {
    if (!tieneTareas) return 'huevo';
    if (nivel <= 3) return 'bebe';
    if (nivel <= 7) return 'joven';
    return 'adulto';
  }

  const NOMBRE_ETAPA = { huevo: 'Huevo', bebe: 'Bebé', joven: 'Joven', adulto: 'Adulta' };
  const PROXIMA_ETAPA = { bebe: { nivel: 4, nombre: 'joven' }, joven: { nivel: 8, nombre: 'adulta' } };

  /**
   * Plan de estudio para un examen (patrón Strategy: se puede reemplazar por otro plan).
   * Reparte hasta 4 sesiones en los 5 días previos al examen, sin usar días pasados.
   * Basado en la evidencia de práctica distribuida y autoevaluación (Dunlosky y otros, 2013).
   */
  class PlanEspaciado {
    constructor() {
      this.tipos = [
        'Repasar la teoría y hacer un resumen',
        'Ejercicios de práctica',
        'Autoevaluación: responder preguntas sin mirar',
        'Repasar solo lo que salió mal'
      ];
    }

    generar(fechaExamen, hoy) {
      const disponibles = [];
      for (let i = 5; i >= 1; i--) {
        const dia = Fecha.sumarDias(fechaExamen, -i);
        if (Fecha.diferencia(hoy, dia) >= 0) disponibles.push(dia);
      }
      const d = disponibles.length;
      const n = Math.min(4, d);
      if (n === 0) return [];
      let indices;
      if (d === 5) indices = [0, 1, 3, 4];
      else if (n === 1) indices = [d - 1];
      else indices = Array.from({ length: n }, (_, i) => Math.round(i * (d - 1) / (n - 1)));
      const tiposPorCantidad = {
        1: [this.tipos[2]],
        2: [this.tipos[0], this.tipos[2]],
        3: [this.tipos[0], this.tipos[1], this.tipos[2]],
        4: this.tipos
      };
      return indices.map((idx, i) => ({ fecha: disponibles[idx], titulo: tiposPorCantidad[n][i] }));
    }
  }

  /**
   * Estado de la mascota, por prioridad:
   * débil (poca vida) > triste (tareas vencidas) > con hambre (no comió hoy) > preocupada (algo para hoy o mañana) > tranquila.
   * Nunca se muere: con la vida en 0 queda desmayada y se recupera comiendo.
   */
  function estadoMascota(resumen) {
    let estado = 'tranquilo';
    if (resumen.vida <= VIDA.DEBIL) estado = 'debil';
    else if (resumen.vencidas > 0) estado = 'triste';
    else if (!resumen.comioHoy && !resumen.vacaciones) estado = 'hambriento';
    else if (resumen.urgentes > 0) estado = 'preocupado';
    const animo = util.limitar(45 + 10 * resumen.sesionesSemana + 3 * (resumen.pomodorosSemana || 0) + 4 * resumen.rachaRevision - 20 * resumen.vencidas, 8, 100);
    return { estado, animo };
  }

  const TEXTO_ESTADO = {
    feliz: { nombre: '¡Ñam!', color: '#C6F25B' },
    tranquilo: { nombre: 'Panza llena', color: '#7BE0A8' },
    preocupado: { nombre: 'Preocupada', color: '#FFB547' },
    hambriento: { nombre: 'Con hambre', color: '#FFB547' },
    triste: { nombre: 'Triste', color: '#FF7A6B' },
    debil: { nombre: 'Débil', color: '#FF7A6B' }
  };

  function mensajeMascota(estado, resumen, nombreMascota) {
    switch (estado) {
      case 'feliz': return '¡Bien ahí! Cuando tu papá la apruebe, sumás monedas.';
      case 'debil':
        if (resumen.vida === 0) return 'Me quedé sin fuerzas. Cada comida me devuelve 1 de vida.';
        return resumen.saldo >= VIDA.COSTO_COMIDA
          ? 'Estoy débil. Necesito comer todos los días para recuperarme.'
          : 'Estoy débil y no hay monedas para comida. Terminá una tarea y dame de comer.';
      case 'triste':
        return resumen.vencidas === 1
          ? 'Hay una tarea vencida. Si la terminás, me pongo contento.'
          : 'Hay ' + resumen.vencidas + ' tareas vencidas. Si las terminás, me pongo contento.';
      case 'hambriento':
        return resumen.saldo >= VIDA.COSTO_COMIDA
          ? 'Tengo hambre. ¿Me das de comer? Si hoy no como, pierdo 1 de vida.'
          : 'Tengo hambre y no alcanzan las monedas. Terminá una tarea para conseguir comida.';
      case 'preocupado':
        return resumen.urgentes === 1
          ? 'Hay 1 cosa para hoy o mañana. ¿La hacemos?'
          : 'Hay ' + resumen.urgentes + ' cosas para hoy o mañana. ¿Arrancamos por una?';
      default:
        return resumen.pendientes === 0 ? 'Panza llena y todo al día. ¡Crack!' : 'Panza llena. Todo bajo control.';
    }
  }

  AQ.reglas = {
    MONEDAS, XP_POR_NIVEL, VIDA, COLORES_MATERIA, COSMETICOS, NOMBRE_ETAPA, PROXIMA_ETAPA, TEXTO_ESTADO,
    color, fondo, nivelDesdeXp, etapa, estadoMascota, mensajeMascota
  };
  AQ.PlanEspaciado = PlanEspaciado;
})(globalThis.AQ = globalThis.AQ || {});
