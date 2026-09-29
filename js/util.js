/*
 * util.js — Funciones auxiliares sin estado: fechas, ids, escape de HTML y hash del PIN.
 * Todas las fechas de la app se guardan como texto 'AAAA-MM-DD' en hora local,
 * así no hay problemas de zona horaria al comparar "hoy", "mañana" o "vencida".
 */
(function (AQ) {
  'use strict';

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_CORTO = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  class Fecha {
    /** Fecha local de hoy como 'AAAA-MM-DD'. Se puede fijar para pruebas con Fecha.fijar(). */
    static hoy() {
      if (Fecha._fija) return Fecha._fija;
      return Fecha.aTexto(new Date());
    }

    static fijar(texto) { Fecha._fija = texto || null; }

    static aTexto(d) {
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dia = String(d.getDate()).padStart(2, '0');
      return d.getFullYear() + '-' + m + '-' + dia;
    }

    static aDate(texto) {
      const [a, m, d] = texto.split('-').map(Number);
      return new Date(a, m - 1, d, 12, 0, 0);
    }

    static sumarDias(texto, n) {
      const d = Fecha.aDate(texto);
      d.setDate(d.getDate() + n);
      return Fecha.aTexto(d);
    }

    /** Días entre dos fechas (b - a). */
    static diferencia(a, b) {
      return Math.round((Fecha.aDate(b) - Fecha.aDate(a)) / 86400000);
    }

    /** Lunes de la semana de esa fecha. */
    static lunes(texto) {
      const d = Fecha.aDate(texto);
      const dow = (d.getDay() + 6) % 7; // 0 = lunes
      return Fecha.sumarDias(texto, -dow);
    }

    static esValida(texto) {
      return /^\d{4}-\d{2}-\d{2}$/.test(texto || '') && !isNaN(Fecha.aDate(texto));
    }

    static diaSemana(texto) { return DIAS[Fecha.aDate(texto).getDay()]; }
    static diaCorto(texto) { return DIAS_CORTO[Fecha.aDate(texto).getDay()]; }
    static numeroDia(texto) { return Fecha.aDate(texto).getDate(); }

    /** "lunes 28 de septiembre" */
    static larga(texto) {
      const d = Fecha.aDate(texto);
      return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    }

    /** Texto relativo corto: "hoy", "mañana", "ayer", "jueves 1", "hace 3 días". */
    static relativa(texto) {
      const n = Fecha.diferencia(Fecha.hoy(), texto);
      if (n === 0) return 'hoy';
      if (n === 1) return 'mañana';
      if (n === -1) return 'ayer';
      if (n > 1 && n < 7) return DIAS[Fecha.aDate(texto).getDay()] + ' ' + Fecha.numeroDia(texto);
      if (n < -1) return 'hace ' + (-n) + ' días';
      const d = Fecha.aDate(texto);
      return d.getDate() + ' de ' + MESES[d.getMonth()];
    }

    static nombreMes(texto) { return MESES[Fecha.aDate(texto).getMonth()]; }
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /** Escapa texto del usuario antes de meterlo en HTML. Nunca se inserta texto sin pasar por acá. */
  function esc(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Hash simple (FNV-1a) para no guardar el PIN a la vista.
   * Ojo: es un candado para chicos, no seguridad real; quien sepa abrir las
   * herramientas del navegador puede cambiar los datos igual.
   */
  function hashPin(pin) {
    let h = 0x811c9dc5;
    const texto = 'agendaquest:' + pin; // no cambiar: invalidaría los PIN ya creados
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function limitar(n, min, max) { return Math.max(min, Math.min(max, n)); }

  /** Nombre de la app: se cambia acá y en el <title> de index.html. */
  AQ.NOMBRE_APP = 'Al Día';

  AQ.Fecha = Fecha;
  AQ.util = { nuevoId, esc, hashPin, limitar };
})(globalThis.AQ = globalThis.AQ || {});
