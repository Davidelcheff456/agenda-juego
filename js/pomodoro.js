/*
 * pomodoro.js — Temporizador Pomodoro (bloques de foco y descanso).
 *
 * La cuenta regresiva se calcula siempre contra una hora de fin (finEn), no sumando
 * segundos: así el tiempo es exacto aunque el celular bloquee la pantalla o el
 * navegador frene la pestaña. El estado se guarda aparte para sobrevivir a una recarga.
 */
(function (AQ) {
  'use strict';

  const OPCIONES_FOCO = [15, 20, 25, 30];
  const OPCIONES_DESCANSO = [5, 10, 20];
  const MIN = 60000;

  class Temporizador {
    /**
     * @param {object} almacen objeto con getItem/setItem/removeItem (o null para no guardar)
     * @param {function} reloj función que devuelve la hora actual en ms (inyectable para pruebas)
     */
    constructor(almacen, reloj) {
      this.almacen = almacen || null;
      this.reloj = reloj || (() => Date.now());
      this.clave = 'agendaquest.pomodoro';
      this.estado = null;
      this._cargar();
    }

    get activo() { return !!this.estado; }

    /** Empieza un bloque de foco. */
    iniciar(perfilId, foco, descanso, tareaId) {
      if (!OPCIONES_FOCO.includes(Number(foco))) throw new AQ.ErrorValidacion('Elegí cuánto dura el pomodoro.');
      if (!OPCIONES_DESCANSO.includes(Number(descanso))) throw new AQ.ErrorValidacion('Elegí cuánto dura el descanso.');
      this.estado = {
        perfilId,
        foco: Number(foco),
        descanso: Number(descanso),
        tareaId: tareaId || null,
        fase: 'foco',
        finEn: this.reloj() + Number(foco) * MIN,
        restanteMs: null,
        completados: 0
      };
      this._guardar();
    }

    /** Empieza otro bloque de foco con la misma configuración. */
    otro() {
      if (!this.estado) return;
      this.estado.fase = 'foco';
      this.estado.finEn = this.reloj() + this.estado.foco * MIN;
      this.estado.restanteMs = null;
      this._guardar();
    }

    pausar() {
      const e = this.estado;
      if (!e || e.restanteMs != null || e.fase === 'listo') return;
      e.restanteMs = Math.max(0, e.finEn - this.reloj());
      e.finEn = null;
      this._guardar();
    }

    reanudar() {
      const e = this.estado;
      if (!e || e.restanteMs == null) return;
      e.finEn = this.reloj() + e.restanteMs;
      e.restanteMs = null;
      this._guardar();
    }

    get pausado() { return !!this.estado && this.estado.restanteMs != null; }

    /** Termina el descanso antes de tiempo y queda listo para otro pomodoro. */
    saltarDescanso() {
      if (!this.estado || this.estado.fase !== 'descanso') return;
      this.estado.fase = 'listo';
      this.estado.finEn = null;
      this.estado.restanteMs = null;
      this._guardar();
    }

    terminar() {
      this.estado = null;
      this._guardar();
    }

    /** Milisegundos que faltan en la fase actual (0 si está esperando). */
    restante() {
      const e = this.estado;
      if (!e || e.fase === 'listo') return 0;
      if (e.restanteMs != null) return e.restanteMs;
      return Math.max(0, e.finEn - this.reloj());
    }

    /** Duración total de la fase actual en ms. */
    total() {
      const e = this.estado;
      if (!e) return 0;
      return (e.fase === 'descanso' ? e.descanso : e.foco) * MIN;
    }

    /**
     * Avanza el reloj. Devuelve un evento si terminó una fase:
     *   { tipo: 'foco-completo', minutos, tareaId } o { tipo: 'descanso-completo' } o null.
     * Al terminar el foco empieza el descanso solo; al terminar el descanso espera
     * a que el estudiante toque "Otro pomodoro".
     */
    tick() {
      const e = this.estado;
      if (!e || e.restanteMs != null || e.fase === 'listo') return null;
      if (this.reloj() < e.finEn) return null;
      if (e.fase === 'foco') {
        const finFoco = e.finEn;
        e.completados += 1;
        e.fase = 'descanso';
        e.finEn = finFoco + e.descanso * MIN;
        // Si la app estuvo cerrada y el descanso también ya pasó, queda listo para el siguiente.
        if (this.reloj() >= e.finEn) { e.fase = 'listo'; e.finEn = null; }
        this._guardar();
        return { tipo: 'foco-completo', perfilId: e.perfilId, minutos: e.foco, tareaId: e.tareaId };
      }
      e.fase = 'listo';
      e.finEn = null;
      this._guardar();
      return { tipo: 'descanso-completo' };
    }

    _cargar() {
      if (!this.almacen) return;
      try {
        const texto = this.almacen.getItem(this.clave);
        this.estado = texto ? JSON.parse(texto) : null;
      } catch (e) { this.estado = null; }
    }

    _guardar() {
      if (!this.almacen) return;
      try {
        if (this.estado) this.almacen.setItem(this.clave, JSON.stringify(this.estado));
        else this.almacen.removeItem(this.clave);
      } catch (e) { /* si no se puede guardar, el temporizador sigue funcionando en memoria */ }
    }
  }

  /** "mm:ss" redondeando hacia arriba, para que nunca muestre 00:00 antes de terminar. */
  function formatear(ms) {
    const s = Math.ceil(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  /** Tres pitidos cortos con Web Audio. Se prepara en un toque del usuario para que el navegador lo permita. */
  class Sonido {
    preparar() {
      try {
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!this.ctx && Ctx) this.ctx = new Ctx();
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { this.ctx = null; }
    }

    tocar(agudo) {
      if (!this.ctx) return;
      try {
        const t0 = this.ctx.currentTime;
        [0, 0.28, 0.56].forEach((d, i) => {
          const osc = this.ctx.createOscillator();
          const vol = this.ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = (agudo ? 880 : 587) * (i === 2 ? 1.5 : 1);
          vol.gain.setValueAtTime(0.0001, t0 + d);
          vol.gain.exponentialRampToValueAtTime(0.12, t0 + d + 0.02);
          vol.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.22);
          osc.connect(vol).connect(this.ctx.destination);
          osc.start(t0 + d);
          osc.stop(t0 + d + 0.24);
        });
      } catch (e) { /* sin sonido */ }
    }
  }

  AQ.Temporizador = Temporizador;
  AQ.Sonido = Sonido;
  AQ.pomodoro = { OPCIONES_FOCO, OPCIONES_DESCANSO, formatear };
})(globalThis.AQ = globalThis.AQ || {});
