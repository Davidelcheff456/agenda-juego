/*
 * repository.js — Capa de acceso a datos (patrón Repository).
 *
 * El resto de la app solo conoce la "interfaz": cargar() y guardar(estado).
 * Fase 1 usa LocalStorageRepository (datos en este navegador).
 * En la fase 2 se escribe, por ejemplo, un SupabaseRepository con los mismos
 * dos métodos y se cambia una sola línea en app.js, sin tocar pantallas ni reglas.
 */
(function (AQ) {
  'use strict';

  const VERSION_DATOS = 1;

  function estadoVacio() {
    return {
      version: VERSION_DATOS,
      pinHash: null,
      perfiles: [],
      materias: [],
      tareas: [],
      examenes: [],
      movimientos: [],
      pomodoros: [],
      premios: [],
      canjes: []
    };
  }

  /** "Interfaz" base: documenta el contrato que cumple cualquier repositorio. */
  class Repositorio {
    /** @returns {object} el estado completo de la app */
    cargar() { throw new Error('cargar() no implementado'); }
    /** @param {object} estado */
    guardar(estado) { throw new Error('guardar() no implementado'); }
  }

  class LocalStorageRepository extends Repositorio {
    constructor(clave, almacenamiento) {
      super();
      this.clave = clave || 'agendaquest.v1';
      this.almacenamiento = almacenamiento || globalThis.localStorage;
    }

    cargar() {
      let texto = null;
      try {
        texto = this.almacenamiento.getItem(this.clave);
      } catch (e) {
        throw new ErrorAlmacenamiento('El navegador no deja guardar datos (¿ventana privada?).');
      }
      if (!texto) return estadoVacio();
      try {
        return Repositorio.normalizar(JSON.parse(texto));
      } catch (e) {
        throw new ErrorAlmacenamiento('Los datos guardados están dañados. Podés importar una copia de seguridad.');
      }
    }

    guardar(estado) {
      try {
        this.almacenamiento.setItem(this.clave, JSON.stringify(estado));
      } catch (e) {
        throw new ErrorAlmacenamiento('No hay más espacio para guardar. Borrá fotos viejas desde el panel del padre.');
      }
    }
  }

  /** Repositorio en memoria: útil para pruebas. */
  class MemoryRepository extends Repositorio {
    constructor(inicial) { super(); this.estado = inicial || estadoVacio(); }
    cargar() { return JSON.parse(JSON.stringify(this.estado)); }
    guardar(estado) { this.estado = JSON.parse(JSON.stringify(estado)); }
  }

  class ErrorAlmacenamiento extends Error {}

  /** Preferencias de cada estudiante (pantalla de Configuración). */
  Repositorio.ajustesBase = function () {
    return { letra: 'normal', sonido: true, animaciones: true, foco: 25, descanso: 5 };
  };

  /** Completa campos faltantes para que datos viejos o importados no rompan la app. */
  Repositorio.normalizar = function (datos) {
    if (!datos || typeof datos !== 'object') throw new Error('Formato inválido');
    const base = estadoVacio();
    for (const clave of Object.keys(base)) {
      if (Array.isArray(base[clave]) && !Array.isArray(datos[clave])) datos[clave] = [];
    }
    if (!('pinHash' in datos)) datos.pinHash = null;
    datos.version = VERSION_DATOS;
    for (const p of datos.perfiles) {
      p.mascota = Object.assign({ nombre: 'Brote', color: 'lima', fondo: 'ninguno', colores: ['lima'], fondos: ['ninguno'] }, p.mascota || {});
      p.bonosSemana = Array.isArray(p.bonosSemana) ? p.bonosSemana : [];
      p.revision = Object.assign({ ultima: null, racha: 0 }, p.revision || {});
      p.vida = Object.assign({ valor: 5, revisadoHasta: null, comioEl: null, vacaciones: false }, p.vida || {});
      p.ajustes = Object.assign(Repositorio.ajustesBase(), p.ajustes || {});
    }
    return datos;
  };

  AQ.estadoVacio = estadoVacio;
  AQ.Repositorio = Repositorio;
  AQ.LocalStorageRepository = LocalStorageRepository;
  AQ.MemoryRepository = MemoryRepository;
  AQ.ErrorAlmacenamiento = ErrorAlmacenamiento;
})(globalThis.AQ = globalThis.AQ || {});
