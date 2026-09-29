/*
 * app.js — Controlador: navegación entre pantallas, eventos y arranque.
 *
 * Flujo: el usuario toca algo → un manejador llama al Store → el Store guarda
 * y avisa (Observer) → la App vuelve a dibujar la pantalla actual.
 */
(function (AQ) {
  'use strict';

  const { Fecha } = AQ;

  const PANTALLAS_PADRE = ['padre', 'padre-ajustes', 'perfil-form', 'premio-form'];
  const PANTALLAS_ESTUDIANTE = ['hoy', 'tarea-form', 'tarea', 'examenes', 'examen-form', 'examen', 'materias', 'materia-form', 'mascota', 'pomodoro', 'ajustes', 'validar'];
  const TITULOS = {
    hoy: 'Hoy', perfiles: 'Perfiles', padre: 'Panel del padre', mascota: 'Mascota', examenes: 'Exámenes', materias: 'Materias', pomodoro: 'Pomodoro', ajustes: 'Configuración', validar: 'Validación'
  };

  function almacenSeguro() {
    try { return globalThis.localStorage || null; } catch (e) { return null; }
  }

  /** Achica la foto para que entre en el almacenamiento del navegador. */
  function comprimirImagen(archivo, maximo, calidad) {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onerror = () => rechazar(new Error('No se pudo leer la foto.'));
      lector.onload = () => {
        const img = new Image();
        img.onerror = () => rechazar(new AQ.ErrorValidacion('Ese archivo no parece una imagen.'));
        img.onload = () => {
          const escala = Math.min(1, maximo / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * escala);
          canvas.height = Math.round(img.height * escala);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolver(canvas.toDataURL('image/jpeg', calidad));
        };
        img.src = lector.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  function descargar(nombre, texto) {
    const blob = new Blob([texto], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  class App {
    constructor(store, raiz, zonaAvisos, zonaDialogo) {
      this.store = store;
      this.raiz = raiz;
      this.zonaAvisos = zonaAvisos;
      this.zonaDialogo = zonaDialogo;
      this.pantalla = 'perfiles';
      this.params = {};
      this.perfilId = null;
      this.padreDesbloqueado = false;
      this.historial = [];
      this.devolviendo = null;
      this.felizHasta = 0;
      this.fotoTemporal = null;
      this.temporizador = new AQ.Temporizador(almacenSeguro());
      this.sonido = new AQ.Sonido();
      this.barraPomodoro = document.getElementById('pomo-barra');
      this.zonaNacimiento = document.getElementById('nacimiento');
      this.mensajeFeliz = null;
      this.diaActual = Fecha.hoy();
      this.store.suscribir(() => this.render());
      this._escuchar();
      this._iniciarReloj();
    }

    // ---------- Pomodoro ----------
    _iniciarReloj() {
      setInterval(() => this._tickPomodoro(), 500);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this._tickPomodoro();
          if (this.temporizador.activo) this._mantenerPantalla(true);
        }
      });
      if (this.barraPomodoro) {
        this.barraPomodoro.addEventListener('click', (ev) => {
          if (!ev.target.closest('button')) return;
          if (this.temporizador.activo) this.perfilId = this.temporizador.estado.perfilId;
          this.ir('pomodoro');
        });
      }
    }

    /** Descuenta vida por los días sin comer. Avisa si la mascota del perfil actual perdió vida. */
    _actualizarVidas() {
      this.store.perfiles.forEach((p) => {
        const perdidas = this.store.actualizarVida(p.id);
        if (perdidas && p.id === this.perfilId && !this.modoPadre) {
          this.aviso(p.mascota.nombre + ' pasó ' + perdidas + (perdidas === 1 ? ' día' : ' días') + ' sin comer y perdió ' + perdidas + ' de vida. ¡Dale de comer!', 'error');
        }
      });
    }

    _tickPomodoro() {
      if (this.diaActual !== Fecha.hoy()) {
        // Pasó la medianoche con la app abierta.
        this.diaActual = Fecha.hoy();
        this._actualizarVidas();
        this.render();
      }
      const T = this.temporizador;
      if (!T.activo) { this._pintarPomodoro(); return; }
      const ev = T.tick();
      if (!ev) { this._pintarPomodoro(); return; }
      if (ev.tipo === 'foco-completo') {
        let monedas = 0;
        try { monedas = this.store.registrarPomodoro(ev.perfilId, ev.minutos, ev.tareaId); } catch (e) { console.error(e); }
        if (this._sonidoActivo(ev.perfilId)) this.sonido.tocar(true);
        if (ev.perfilId === this.perfilId) { this.felizHasta = Date.now() + 3500; this.mensajeFeliz = '¡Pomodoro completo! Ahora a descansar.'; }
        this.aviso(monedas > 0
          ? '¡Pomodoro completo! +' + monedas + ' monedas. Ahora, ' + T.estado.descanso + ' min de descanso.'
          : '¡Pomodoro completo! Ya llegaste al tope de monedas de hoy, pero el estudio cuenta igual.', 'ok');
      } else {
        if (this._sonidoActivo(T.estado && T.estado.perfilId)) this.sonido.tocar(false);
        this.aviso('Terminó el descanso. ¿Otro pomodoro?', 'ok');
      }
      this.render();
    }

    /** Actualiza el reloj, el anillo, la barra fija y el título sin redibujar la pantalla. */
    _pintarPomodoro() {
      const T = this.temporizador;
      const barra = this.barraPomodoro;
      const texto = T.activo && T.estado.fase !== 'listo' ? AQ.pomodoro.formatear(T.restante()) : '';
      const reloj = this.raiz.querySelector('#pomo-tiempo');
      if (reloj && reloj.textContent !== texto) reloj.textContent = texto;
      const anillo = this.raiz.querySelector('#pomo-anillo');
      if (anillo && T.activo) {
        const C = AQ.vistas.anilloPomodoro.CIRCUNFERENCIA;
        anillo.setAttribute('stroke-dashoffset', (C * (1 - T.restante() / T.total())).toFixed(2));
      }
      const fases = { foco: 'Foco', descanso: 'Descanso', listo: 'Listo' };
      const base = (TITULOS[this.pantalla] ? TITULOS[this.pantalla] + ' · ' : '') + AQ.NOMBRE_APP;
      document.title = T.activo ? (texto ? texto + ' ' : '') + fases[T.estado.fase] + ' · ' + base : base;

      if (!barra) return;
      // Visible en todas las pantallas menos la del propio pomodoro, que ya lo muestra grande.
      const mostrar = T.activo && this.pantalla !== 'pomodoro';
      barra.hidden = !mostrar;
      document.body.classList.toggle('con-barra-pomo', mostrar);
      if (!mostrar) return;
      const e = T.estado;
      const perfil = this.store.perfil(e.perfilId);
      const etiqueta = e.fase === 'listo' ? 'Descanso terminado · ¿otro?' : fases[e.fase] + (T.pausado ? ' (pausa)' : '');
      const html = '<button type="button" class="pomo-barra-boton fase-' + e.fase + '" aria-label="Ir al pomodoro">' +
        '<span class="pomo-punto"></span><span class="pomo-etiqueta">' + AQ.util.esc(etiqueta) +
        (perfil && e.perfilId !== this.perfilId ? ' · ' + AQ.util.esc(perfil.nombre) : '') + '</span>' +
        '<span class="pomo-barra-tiempo">' + texto + '</span><span class="pomo-ver">Ver</span></button>';
      if (barra.dataset.html !== html) { barra.innerHTML = html; barra.dataset.html = html; }
    }

    /** Aplica tamaño de letra y animaciones del perfil activo (en el panel del padre, los valores normales). */
    _aplicarAjustes() {
      const usar = this.perfil() && !this.modoPadre && PANTALLAS_ESTUDIANTE.includes(this.pantalla);
      const a = usar ? this.store.ajustes(this.perfilId) : AQ.Repositorio.ajustesBase();
      document.documentElement.dataset.letra = a.letra;
      document.body.classList.toggle('sin-animaciones', !a.animaciones);
    }

    _sonidoActivo(perfilId) {
      return this.store.ajustes(perfilId || this.perfilId).sonido !== false;
    }

    /** Pide que la pantalla no se apague durante el pomodoro (si el navegador lo permite). */
    _mantenerPantalla(si) {
      try {
        if (si && navigator.wakeLock && !this.bloqueoPantalla) {
          navigator.wakeLock.request('screen').then((b) => {
            this.bloqueoPantalla = b;
            b.addEventListener('release', () => { this.bloqueoPantalla = null; });
          }).catch(() => {});
        }
        if (!si && this.bloqueoPantalla) { this.bloqueoPantalla.release().catch(() => {}); this.bloqueoPantalla = null; }
      } catch (e) { /* no disponible */ }
    }

    get modoPadre() { return this.padreDesbloqueado; }
    perfil() { return this.store.perfil(this.perfilId); }
    felizActivo() { return Date.now() < this.felizHasta; }

    iniciar() {
      this._actualizarVidas();
      this.ir(this.store.tienePin() ? 'perfiles' : 'bienvenida', {}, { sinHistorial: true });
    }

    /** Navegar a una pantalla. opciones: sinHistorial (no guardar la actual), reemplazar. */
    ir(pantalla, params, opciones) {
      const op = opciones || {};
      params = params || {};
      if (pantalla !== 'validar') this.validando = false;
      else if (!this.validando) return this.ir('hoy', {}, op);
      if (PANTALLAS_PADRE.includes(pantalla) && !this.padreDesbloqueado) {
        return this.ir('pin', { destino: pantalla }, op);
      }
      if (PANTALLAS_ESTUDIANTE.includes(pantalla) && !this.perfil()) {
        return this.ir('perfiles', {}, { sinHistorial: true });
      }
      if (!op.sinHistorial && !op.reemplazar && this.pantalla !== pantalla) {
        this.historial.push({ pantalla: this.pantalla, params: this.params });
        if (this.historial.length > 30) this.historial.shift();
      }
      if (pantalla === 'tarea-form') {
        const t = params.id ? this.store.tarea(params.id) : null;
        this.fotoTemporal = t ? t.foto : null;
      }
      this.pantalla = pantalla;
      this.params = params;
      this.devolviendo = null;
      this.render();
      window.scrollTo(0, 0);
      const titulo = this.raiz.querySelector('h1');
      const conFoco = this.raiz.querySelector('[autofocus]');
      if (conFoco) conFoco.focus();
      else if (titulo) { titulo.setAttribute('tabindex', '-1'); titulo.focus({ preventScroll: true }); }
    }

    atras(respaldo) {
      const anterior = this.historial.pop();
      if (anterior) this.ir(anterior.pantalla, anterior.params, { sinHistorial: true });
      else this.ir(respaldo || 'perfiles', {}, { sinHistorial: true });
    }

    render() {
      const vista = AQ.vistas[this.pantalla];
      this.raiz.innerHTML = vista ? vista(this) : '';
      this.raiz.dataset.pantalla = this.pantalla;
      this._aplicarAjustes();
      this._mostrarNacimiento();
      this._pintarPomodoro();
    }

    /**
     * Si la mascota salió del huevo y el estudiante todavía no lo vio, muestra la escena de nacimiento
     * encima de Hoy o de la pantalla de la mascota (no en el panel del padre ni durante la validación).
     */
    _mostrarNacimiento() {
      const zona = this.zonaNacimiento;
      if (!zona) return;
      const mostrar = !this.modoPadre && !this.validando && ['hoy', 'mascota'].includes(this.pantalla) &&
        this.perfil() && this.store.nacimientoPendiente(this.perfilId);
      if (!mostrar) { if (zona.innerHTML) zona.innerHTML = ''; return; }
      if (zona.dataset.perfil === this.perfilId && zona.innerHTML) return; // ya está en pantalla
      const m = this.store.mascota(this.perfilId);
      const esc = AQ.util.esc;
      zona.dataset.perfil = this.perfilId;
      zona.innerHTML = '<div class="fondo-dialogo nacimiento">' +
        '<div class="dialogo nacimiento-caja" role="dialog" aria-modal="true" aria-labelledby="nac-titulo">' +
        AQ.escenaNacimiento(m.color, 144) +
        '<h2 id="nac-titulo" class="titulo-pixel nac-texto">¡Nació ' + esc(m.nombre) + '!</h2>' +
        '<p class="texto-suave nac-texto">Papá te validó ' + AQ.reglas.TAREAS_PARA_NACER + ' tareas y salió del huevo. Ahora comé con él una vez por día: cada comida cuesta ' +
        AQ.reglas.VIDA.COSTO_COMIDA + ' monedas y le da vida.</p>' +
        '<button type="button" class="boton primario ancho grande nac-texto" data-nacimiento="ok">¡Hola, ' + esc(m.nombre) + '!</button>' +
        '</div></div>';
      zona.querySelector('[data-nacimiento="ok"]').addEventListener('click', () => {
        zona.innerHTML = '';
        this.felizHasta = Date.now() + 3500;
        this.mensajeFeliz = '¡Hola! Soy ' + m.nombre + '. Dame de comer una vez por día y vamos a estar bárbaro.';
        this.store.marcarNacimientoVisto(this.perfilId);
        setTimeout(() => { if (!this.felizActivo()) this.render(); }, 3600);
      });
      if (this._sonidoActivo(this.perfilId)) setTimeout(() => this.sonido.tocar(true), 1700);
      setTimeout(() => { const b = zona.querySelector('[data-nacimiento="ok"]'); if (b) b.focus({ preventScroll: true }); }, 50);
    }

    /**
     * Diálogo propio (en lugar de confirm/prompt del navegador, que algunos visores bloquean).
     * op: { titulo, mensaje, confirmar, cancelar, peligro, escribir (texto exacto a tipear),
     *       area (true: campo de texto grande), valor, soloLectura }
     * Devuelve una promesa: true (o el texto ingresado) si confirma, false si cancela.
     */
    dialogo(op) {
      const zona = this.zonaDialogo;
      const previo = document.activeElement;
      const esc = AQ.util.esc;
      const conCampo = op.escribir || op.area;
      zona.innerHTML =
        '<div class="fondo-dialogo">' +
        '<div class="dialogo" role="dialog" aria-modal="true" aria-labelledby="dialogo-titulo">' +
        '<h2 id="dialogo-titulo" class="titulo-chico">' + esc(op.titulo) + '</h2>' +
        (op.mensaje ? '<p class="texto-suave">' + esc(op.mensaje) + '</p>' : '') +
        (op.escribir ? '<label for="dialogo-campo" class="texto-chico">Escribí <b>' + esc(op.escribir) + '</b> para confirmar</label><input id="dialogo-campo" type="text" autocomplete="off">' : '') +
        (op.clave ? '<label for="dialogo-campo" class="texto-chico">' + esc(op.clave) + '</label><input id="dialogo-campo" class="campo-pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off">' : '') +
        (op.error ? '<p class="texto-error" role="alert">' + esc(op.error) + '</p>' : '') +
        (op.area ? '<textarea id="dialogo-campo" rows="8"' + (op.soloLectura ? ' readonly' : '') + ' aria-label="' + esc(op.titulo) + '">' + esc(op.valor || '') + '</textarea>' : '') +
        '<div class="fila-botones">' +
        (op.cancelar === null ? '' : '<button type="button" class="boton secundario" data-dialogo="no">' + esc(op.cancelar || 'Cancelar') + '</button>') +
        '<button type="button" class="boton ' + (op.peligro ? 'peligro-lleno' : 'primario') + ' confirmar" data-dialogo="si">' + esc(op.confirmar || 'Aceptar') + '</button>' +
        '</div></div></div>';
      const campo = zona.querySelector('#dialogo-campo');
      const botonSi = zona.querySelector('[data-dialogo="si"]');
      (campo && !op.soloLectura ? campo : botonSi).focus();
      if (campo && op.soloLectura) campo.select();
      return new Promise((resolver) => {
        const cerrar = (valor) => {
          zona.innerHTML = '';
          document.removeEventListener('keydown', tecla, true);
          if (previo && document.body.contains(previo)) previo.focus();
          resolver(valor);
        };
        const tecla = (ev) => {
          if (ev.key === 'Escape') { ev.preventDefault(); cerrar(false); }
          if (ev.key === 'Tab') {
            const focos = Array.from(zona.querySelectorAll('button, input, textarea'));
            const i = focos.indexOf(document.activeElement);
            if (ev.shiftKey && i <= 0) { ev.preventDefault(); focos[focos.length - 1].focus(); }
            else if (!ev.shiftKey && i === focos.length - 1) { ev.preventDefault(); focos[0].focus(); }
          }
          if (ev.key === 'Enter' && campo && campo.tagName === 'INPUT') { ev.preventDefault(); botonSi.click(); }
        };
        document.addEventListener('keydown', tecla, true);
        zona.querySelector('.fondo-dialogo').addEventListener('click', (ev) => {
          const b = ev.target.closest('[data-dialogo]');
          if (ev.target.classList.contains('fondo-dialogo')) return cerrar(false);
          if (!b) return;
          if (b.dataset.dialogo === 'no') return cerrar(false);
          if (op.escribir) {
            if (campo.value.trim().toUpperCase() !== op.escribir) { campo.focus(); campo.setAttribute('aria-invalid', 'true'); return; }
            return cerrar(true);
          }
          if (op.clave) return cerrar(campo.value);
          cerrar(op.area && !op.soloLectura ? campo.value : true);
        });
      });
    }

    aviso(texto, tipo) {
      while (this.zonaAvisos.children.length >= 2) this.zonaAvisos.firstElementChild.remove();
      const el = document.createElement('div');
      el.className = 'aviso ' + (tipo || '');
      el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
      el.textContent = texto;
      this.zonaAvisos.appendChild(el);
      setTimeout(() => el.classList.add('saliendo'), 3200);
      setTimeout(() => el.remove(), 3600);
    }

    _proteger(fn) {
      try {
        const r = fn();
        if (r && typeof r.catch === 'function') r.catch((e) => this._error(e));
      } catch (e) { this._error(e); }
    }

    _error(e) {
      if (e instanceof AQ.ErrorValidacion || e instanceof AQ.ErrorAlmacenamiento) this.aviso(e.message, 'error');
      else { console.error(e); this.aviso('Algo salió mal. Probá de nuevo.', 'error'); }
    }

    _escuchar() {
      this.raiz.addEventListener('click', (ev) => {
        const el = ev.target.closest('[data-accion]');
        if (!el || el.disabled) return;
        const fn = this.acciones[el.dataset.accion];
        if (fn) { ev.preventDefault(); this._proteger(() => fn.call(this, el)); }
      });
      this.raiz.addEventListener('submit', (ev) => {
        const form = ev.target.closest('form[data-form]');
        if (!form) return;
        ev.preventDefault();
        const fn = this.formularios[form.dataset.form];
        const datos = Object.fromEntries(new FormData(form).entries());
        if (ev.submitter && ev.submitter.name) datos[ev.submitter.name] = ev.submitter.value;
        if (fn) this._proteger(() => fn.call(this, form, datos));
      });
      this.raiz.addEventListener('change', (ev) => {
        const el = ev.target.closest('[data-cambio]');
        if (!el) return;
        const fn = this.cambios[el.dataset.cambio];
        if (fn) this._proteger(() => fn.call(this, el));
      });
    }

    /**
     * Verifica el PIN del padre. Después de 5 intentos fallidos bloquea 1 minuto,
     * para que no se pueda adivinar probando números.
     */
    /** Las acciones de validar solo valen con el panel del padre abierto o con el PIN recién puesto. */
    _exigirPadre() {
      if (!this.modoPadre && !this.validando) throw new AQ.ErrorValidacion('Para validar hace falta el PIN de papá.');
    }

    _chequearPin(pin) {
      const ahora = Date.now();
      if (this.pinBloqueadoHasta && ahora < this.pinBloqueadoHasta) {
        const seg = Math.ceil((this.pinBloqueadoHasta - ahora) / 1000);
        throw new AQ.ErrorValidacion('Demasiados intentos. Esperá ' + seg + ' segundos.');
      }
      if (this.store.verificarPin(pin)) { this.intentosPin = 0; return true; }
      this.intentosPin = (this.intentosPin || 0) + 1;
      if (this.intentosPin >= 5) {
        this.intentosPin = 0;
        this.pinBloqueadoHasta = ahora + 60000;
        throw new AQ.ErrorValidacion('PIN incorrecto 5 veces. Esperá 1 minuto.');
      }
      return false;
    }

    _importarTexto(texto) {
      this.store.importar(texto);
      this.padreDesbloqueado = false;
      this.perfilId = null;
      this.historial = [];
      this.iniciar();
      this.aviso('Copia importada.', 'ok');
    }

    _entrarComoPadre() {
      this.padreDesbloqueado = true;
      let bonos = 0;
      this.store.perfiles.forEach((p) => { bonos += this.store.evaluarSemanas(p.id); });
      if (bonos) this.aviso('Se acreditaron bonos de semana sin vencidas.', 'ok');
      if (!this.perfilId && this.store.perfiles[0]) this.perfilId = this.store.perfiles[0].id;
    }
  }

  // ---------- Acciones (clics) ----------
  App.prototype.acciones = {
    ir(el) {
      const params = {};
      if (el.dataset.id) params.id = el.dataset.id;
      if (el.dataset.volver) params.volver = el.dataset.volver;
      this.ir(el.dataset.pantalla, params);
    },
    atras(el) { this.atras(el.dataset.pantalla); },

    entrar(el) {
      this.perfilId = el.dataset.id;
      this.padreDesbloqueado = false;
      this.historial = [];
      this._actualizarVidas();
      const bono = this.store.evaluarSemanas(this.perfilId);
      this.ir('hoy', {}, { sinHistorial: true });
      if (bono) this.aviso('¡Bono! +' + bono + ' monedas por semanas sin tareas vencidas.', 'ok');
    },

    'pedir-pin'(el) {
      if (this.padreDesbloqueado) this.ir(el.dataset.destino);
      else this.ir('pin', { destino: el.dataset.destino });
    },

    marcar(el) {
      const monedas = this.store.marcarHecha(el.dataset.id);
      this.felizHasta = Date.now() + 3500;
      this.mensajeFeliz = '¡Bien ahí! Mostrásela a tu papá: cuando la valide, sumás más monedas.';
      if (this.pantalla === 'tarea') this.atras('hoy');
      else this.render();
      setTimeout(() => { if (!this.felizActivo()) this.render(); }, 3600);
      this.aviso(monedas ? '¡Hecha! +' + monedas + ' monedas. Validala con papá para ganar más.' : 'Hecha. Validala con papá para ganar las monedas.', 'ok');
    },

    /** El padre valida en el celular del estudiante: pide el PIN en un diálogo y abre la pantalla de validación. */
    async validar() {
      let error = '';
      for (;;) {
        const pin = await this.dialogo({
          titulo: 'Validación de papá',
          mensaje: 'Pasale el celular a tu papá para que ponga su PIN.',
          clave: 'PIN del padre (4 números)',
          confirmar: 'Validar',
          error
        });
        if (pin === false) return;
        try {
          if (this._chequearPin(pin)) break;
          error = 'PIN incorrecto. Probá de nuevo.';
        } catch (e) {
          if (e instanceof AQ.ErrorValidacion) { error = e.message; continue; }
          throw e;
        }
      }
      this.validando = true;
      this.devolviendo = null;
      this.ir('validar');
    },

    'aprobar-todas'() {
      this._exigirPadre();
      const lista = this.store.tareasDe(this.perfilId).filter((t) => t.estado === 'enviada');
      let total = 0;
      const eraHuevo = !this.store.nacida(this.perfilId);
      lista.forEach((t) => { total += this.store.aprobar(t.id); });
      this.aviso(eraHuevo && this.store.nacida(this.perfilId)
        ? '¡Validadas ' + lista.length + ' tareas y el huevo se abrió! +' + total + ' monedas.'
        : 'Validadas ' + lista.length + ' tareas: +' + total + ' monedas.', 'ok');
    },

    'terminar-validar'() {
      this.validando = false;
      this.devolviendo = null;
      this.felizHasta = Date.now() + 3500;
      this.mensajeFeliz = '¡Qué bien! Papá validó tus tareas.';
      this.historial = [];
      this.ir('hoy', {}, { sinHistorial: true });
      setTimeout(() => { if (!this.felizActivo()) this.render(); }, 3600);
    },

    desmarcar(el) {
      this.store.desmarcar(el.dataset.id);
      this.felizHasta = 0;
    },

    async 'borrar-tarea'(el) {
      const t = this.store.tarea(el.dataset.id);
      if (!t) return;
      const dio = this.store.monedasDeTarea(t.id);
      const descuento = dio ? 'Se descuentan las ' + dio + ' monedas que ya te dio.' : '';
      if (!await this.dialogo({ titulo: '¿Borrar "' + t.titulo + '"?', mensaje: descuento, confirmar: 'Borrar', peligro: true })) return;
      this.store.eliminarTarea(t.id);
      if (this.pantalla === 'tarea') this.atras(this.modoPadre ? 'padre' : 'hoy');
      this.aviso('Tarea borrada.');
    },

    'fecha-rapida'(el) {
      const input = this.raiz.querySelector('#vence');
      if (input) input.value = el.dataset.valor;
    },

    'quitar-foto'() {
      this.fotoTemporal = null;
      const prev = this.raiz.querySelector('#foto-preview');
      if (prev) prev.innerHTML = '';
    },

    async 'borrar-examen'(el) {
      if (!await this.dialogo({ titulo: '¿Borrar el examen?', mensaje: 'También se borran las sesiones de estudio que no se aprobaron.', confirmar: 'Borrar', peligro: true })) return;
      this.store.eliminarExamen(el.dataset.id);
      this.atras(this.modoPadre ? 'padre' : 'examenes');
    },

    async 'borrar-materia'(el) {
      const m = this.store.materia(el.dataset.id);
      if (!m || !await this.dialogo({ titulo: '¿Borrar la materia ' + m.nombre + '?', confirmar: 'Borrar', peligro: true })) return;
      this.store.eliminarMateria(m.id);
      this.atras('materias');
    },

    async canjear(el) {
      const pr = this.store.premios.find((x) => x.id === el.dataset.id);
      if (!pr || !await this.dialogo({ titulo: '¿Canjear "' + pr.nombre + '"?', mensaje: 'Cuesta ' + pr.precio + ' monedas. Después avisale a tu papá.', confirmar: 'Canjear' })) return;
      this.store.canjear(this.perfilId, pr.id);
      this.aviso('¡Canjeado! Avisale a tu papá para que te lo dé.', 'ok');
    },

    alimentar() {
      const recupero = this.store.alimentar(this.perfilId);
      this.felizHasta = Date.now() + 3500;
      this.mensajeFeliz = recupero ? '¡Ñam, qué rico! Recuperé 1 de vida.' : '¡Ñam, qué rico! Gracias.';
      this.render();
      setTimeout(() => { if (!this.felizActivo()) this.render(); }, 3600);
    },

    vacaciones(el) {
      const activo = el.dataset.valor === '1';
      this.store.ponerVacaciones(this.perfilId, activo);
      this.aviso(activo ? 'Modo vacaciones activado: la mascota no pierde vida.' : 'Modo vacaciones terminado. Desde mañana vuelve a necesitar comida.', 'ok');
    },

    comprar(el) {
      this.store.comprarCosmetico(this.perfilId, el.dataset.tipo, el.dataset.id);
      this.felizHasta = Date.now() + 2500;
      this.mensajeFeliz = '¡Me encanta mi nuevo look!';
      this.render();
      this.aviso('¡Nuevo look para tu mascota!', 'ok');
    },

    equipar(el) { this.store.equipar(this.perfilId, el.dataset.tipo, el.dataset.id); },

    'elegir-perfil-padre'(el) {
      this.perfilId = el.dataset.id;
      this.devolviendo = null;
      this.render();
    },

    revision() {
      const r = this.store.registrarRevision(this.perfilId);
      this.aviso(r.bono ? '¡Racha de ' + r.racha + ' días! +' + r.bono + ' monedas.' : 'Revisión registrada. Racha: ' + r.racha + (r.racha === 1 ? ' día.' : ' días.'), 'ok');
    },

    aprobar(el) {
      this._exigirPadre();
      const t = this.store.tarea(el.dataset.id);
      const monto = this.store.aprobar(el.dataset.id);
      const p = this.store.perfil(t.perfilId);
      if (this.store.nacimientoPendiente(p.id) && this.store.tareasValidadas(p.id) === AQ.reglas.TAREAS_PARA_NACER) {
        this.aviso('¡El huevo se abrió! ' + p.nombre + ' lo va a ver nacer en su pantalla.', 'ok');
      } else {
        this.aviso('Validada: +' + monto + ' monedas para ' + p.nombre + '.', 'ok');
      }
    },

    devolver(el) {
      this._exigirPadre();
      this.devolviendo = el.dataset.id;
      this.render();
      const input = this.raiz.querySelector('.form-devolver input');
      if (input) input.focus();
    },

    'cancelar-devolver'() { this.devolviendo = null; this.render(); },

    entregado(el) { this.store.marcarEntregado(el.dataset.id); this.aviso('Canje marcado como entregado.', 'ok'); },

    async 'cancelar-canje'(el) {
      if (!await this.dialogo({ titulo: '¿Cancelar el canje?', mensaje: 'Las monedas vuelven al saldo.', confirmar: 'Cancelar canje', cancelar: 'Volver', peligro: true })) return;
      this.store.cancelarCanje(el.dataset.id);
      this.aviso('Canje cancelado, monedas devueltas.');
    },

    'pomo-pausar'() { this.temporizador.pausar(); this.render(); },
    'pomo-reanudar'() { this.sonido.preparar(); this.temporizador.reanudar(); this._mantenerPantalla(true); this.render(); },
    'pomo-saltar'() { this.temporizador.saltarDescanso(); this.render(); },
    'pomo-otro'() {
      this.sonido.preparar();
      this.temporizador.otro();
      this._mantenerPantalla(true);
      this.render();
    },
    async 'pomo-terminar'() {
      const T = this.temporizador;
      if (T.activo && T.estado.fase === 'foco' && !await this.dialogo({
        titulo: '¿Terminar el pomodoro?', mensaje: 'Si lo cortás ahora, este pomodoro no suma monedas.', confirmar: 'Terminar', cancelar: 'Seguir estudiando', peligro: true
      })) return;
      const hechos = T.activo ? T.estado.completados : 0;
      T.terminar();
      this._mantenerPantalla(false);
      this.render();
      if (hechos) this.aviso('¡Bien! Completaste ' + hechos + (hechos === 1 ? ' pomodoro.' : ' pomodoros.'), 'ok');
    },

    'salir-perfil'() {
      this.perfilId = null;
      this.historial = [];
      this.ir('perfiles', {}, { sinHistorial: true });
      this.aviso('Saliste de tu cuenta. ¡Hasta la próxima!', 'ok');
    },

    'probar-sonido'() {
      this.sonido.preparar();
      this.sonido.tocar(true);
    },

    'salir-padre'() {
      this.padreDesbloqueado = false;
      this.historial = [];
      this.ir('perfiles', {}, { sinHistorial: true });
    },

    exportar() {
      // Dentro de un visor embebido (iframe) las descargas suelen estar bloqueadas: se ofrece copiar el texto.
      if (window.self !== window.top) return this.acciones['copiar-copia'].call(this);
      descargar('al-dia-copia-' + Fecha.hoy() + '.json', this.store.exportar());
      this.aviso('Si no apareció la descarga, usá "Copiar copia como texto".', 'ok');
    },

    async 'copiar-copia'() {
      const texto = this.store.exportar();
      try {
        await navigator.clipboard.writeText(texto);
        this.aviso('Copia copiada. Pegala en un archivo de texto o en un mail para vos.', 'ok');
      } catch (e) {
        await this.dialogo({ titulo: 'Copia de seguridad', mensaje: 'Seleccioná todo el texto y copialo a un lugar seguro.', area: true, valor: texto, soloLectura: true, confirmar: 'Listo', cancelar: null });
      }
    },

    async 'pegar-copia'() {
      const texto = await this.dialogo({ titulo: 'Pegar copia de seguridad', mensaje: 'Pegá el texto de una copia. Reemplaza todos los datos actuales de este navegador.', area: true, confirmar: 'Importar', peligro: true });
      if (!texto) return;
      this._importarTexto(texto);
    },

    importar() { const i = this.raiz.querySelector('#archivo-importar'); if (i) i.click(); },
    'importar-inicio'() { const i = this.raiz.querySelector('#archivo-importar'); if (i) i.click(); },

    async 'borrar-fotos'() {
      if (!await this.dialogo({ titulo: '¿Borrar fotos de tareas aprobadas?', mensaje: 'Libera espacio. Las tareas quedan, solo se borran sus fotos.', confirmar: 'Borrar fotos', peligro: true })) return;
      const n = this.store.borrarFotosAprobadas();
      this.aviso(n ? 'Se borraron ' + n + (n === 1 ? ' foto.' : ' fotos.') : 'No había fotos para borrar.');
    },

    async 'borrar-todo'() {
      const ok = await this.dialogo({ titulo: '¿Borrar todos los datos?', mensaje: 'Se borran perfiles, tareas, exámenes, monedas y el PIN. No se puede deshacer.', escribir: 'BORRAR', confirmar: 'Borrar todo', peligro: true });
      if (!ok) return;
      this.store.borrarTodo();
      this.padreDesbloqueado = false;
      this.perfilId = null;
      this.historial = [];
      this.iniciar();
    },

    async 'borrar-perfil'(el) {
      const p = this.store.perfil(el.dataset.id);
      if (!p || !await this.dialogo({ titulo: '¿Borrar el perfil de ' + p.nombre + '?', mensaje: 'Se borran sus tareas, exámenes, monedas y mascota. No se puede deshacer.', escribir: 'BORRAR', confirmar: 'Borrar perfil', peligro: true })) return;
      this.store.eliminarPerfil(p.id);
      if (this.perfilId === p.id) this.perfilId = this.store.perfiles[0] ? this.store.perfiles[0].id : null;
      this.atras('padre-ajustes');
    },

    async 'borrar-premio'(el) {
      if (!await this.dialogo({ titulo: '¿Borrar este premio?', confirmar: 'Borrar', peligro: true })) return;
      this.store.eliminarPremio(el.dataset.id);
      this.atras('padre-ajustes');
    }
  };

  // ---------- Formularios ----------
  App.prototype.formularios = {
    'crear-pin'(form, d) {
      if (d.pin1 !== d.pin2) throw new AQ.ErrorValidacion('Los dos PIN no coinciden.');
      this.store.configurarPin(d.pin1);
      this.padreDesbloqueado = true;
      this.ir('perfil-form', {}, { sinHistorial: true });
    },

    pin(form, d) {
      if (!this._chequearPin(d.pin)) {
        this.ir('pin', { destino: this.params.destino, error: true }, { reemplazar: true });
        return;
      }
      this._entrarComoPadre();
      this.ir(this.params.destino || 'padre', {}, { reemplazar: true });
    },

    tarea(form, d) {
      if (this.params.id) {
        const t = this.store.tarea(this.params.id);
        const cambios = t.tipo === 'sesion' ? { vence: d.vence } : { titulo: d.titulo, detalle: d.detalle, vence: d.vence, materiaId: d.materiaId, foto: this.fotoTemporal };
        this.store.editarTarea(t.id, cambios);
        this.aviso('Cambios guardados.', 'ok');
        this.atras(this.modoPadre ? 'padre' : 'hoy');
        return;
      }
      this.store.agregarTarea(this.perfilId, { materiaId: d.materiaId, titulo: d.titulo, detalle: d.detalle, vence: d.vence, foto: this.fotoTemporal }, this.modoPadre);
      this.fotoTemporal = null;
      if (this.modoPadre) {
        this.aviso('Tarea agregada.', 'ok');
      } else {
        this.felizHasta = Date.now() + 3000;
        this.mensajeFeliz = '¡Anotada! Así no se te olvida.';
        setTimeout(() => { if (!this.felizActivo()) this.render(); }, 3100);
        this.aviso('Anotada. +' + AQ.reglas.MONEDAS.ANOTAR + ' monedas.', 'ok');
      }
      this.atras(this.modoPadre ? 'padre' : 'hoy');
    },

    examen(form, d) {
      const x = this.store.agregarExamen(this.perfilId, d);
      this.aviso('Examen agendado con su plan de estudio.', 'ok');
      this.ir('examen', { id: x.id }, { reemplazar: true });
    },

    'nota-examen'(form, d) {
      this.store.editarExamen(form.dataset.id, { nota: d.nota });
      this.aviso('Nota guardada.', 'ok');
    },

    materia(form, d) {
      if (this.params.id) {
        this.store.editarMateria(this.params.id, d);
        this.aviso('Materia guardada.', 'ok');
        this.atras('materias');
        return;
      }
      this.store.agregarMateria(this.perfilId, d);
      this.aviso(d.nombre.trim() + ' agregada.', 'ok');
      if (d.otra) this.ir('materia-form', { volver: this.params.volver }, { reemplazar: true });
      else this.atras('materias');
    },

    perfil(form, d) {
      const primero = this.store.perfiles.length === 0;
      if (this.params.id) {
        this.store.editarPerfil(this.params.id, d);
        this.aviso('Perfil guardado.', 'ok');
        this.atras('padre-ajustes');
        return;
      }
      const p = this.store.agregarPerfil(d);
      this.perfilId = p.id;
      this.aviso('Perfil de ' + p.nombre + ' creado.', 'ok');
      if (primero) {
        this.padreDesbloqueado = false;
        this.historial = [];
        this.ir('perfiles', {}, { sinHistorial: true });
      } else {
        this.atras('padre-ajustes');
      }
    },

    premio(form, d) {
      if (this.params.id) this.store.editarPremio(this.params.id, d);
      else this.store.agregarPremio(d);
      this.aviso('Premio guardado.', 'ok');
      this.atras('padre-ajustes');
    },

    devolver(form, d) {
      this._exigirPadre();
      this.store.devolver(form.dataset.id, d.nota);
      this.devolviendo = null;
      this.render();
      this.aviso('Tarea devuelta con tu nota.');
    },

    pomodoro(form, d) {
      this.sonido.preparar();
      this.temporizador.iniciar(this.perfilId, d.foco, d.descanso, d.tareaId || null);
      // La última elección queda como predeterminada para la próxima vez.
      try { this.store.editarAjustes(this.perfilId, { foco: d.foco, descanso: d.descanso }); } catch (e) { /* no es grave */ }
      this._mantenerPantalla(true);
      this.render();
      window.scrollTo(0, 0);
    },

    'nombre-mascota'(form, d) {
      this.store.renombrarMascota(this.perfilId, d.nombre);
      this.aviso('Ahora tu mascota se llama ' + d.nombre.trim() + '.', 'ok');
    },

    'cambiar-pin'(form, d) {
      this.store.cambiarPin(d.actual, d.nuevo);
      form.reset();
      this.aviso('PIN cambiado.', 'ok');
    }
  };

  // ---------- Cambios en campos ----------
  App.prototype.cambios = {
    ajuste(el) {
      const valor = el.type === 'checkbox' ? el.checked : el.value;
      this.store.editarAjustes(this.perfilId, { [el.name]: valor });
      const foco = this.raiz.querySelector('[name="' + el.name + '"]' + (el.type === 'checkbox' ? '' : '[value="' + el.value + '"]'));
      if (foco) foco.focus();
    },

    foto(el) {
      const archivo = el.files && el.files[0];
      if (!archivo) return;
      return comprimirImagen(archivo, 1024, 0.6).then((url) => {
        this.fotoTemporal = url;
        const prev = this.raiz.querySelector('#foto-preview');
        if (prev) prev.innerHTML = '<img src="' + url + '" alt="Foto adjunta"><button type="button" class="enlace" data-accion="quitar-foto">Quitar foto</button>';
      });
    },

    plan(el) {
      const lista = this.raiz.querySelector('#plan-preview');
      if (lista) lista.innerHTML = AQ.vistas.planPreview(this, el.value);
    },

    importar(el) {
      const archivo = el.files && el.files[0];
      if (!archivo) return;
      return archivo.text().then(async (texto) => {
        el.value = '';
        if (this.store.perfiles.length && !await this.dialogo({ titulo: '¿Importar la copia?', mensaje: 'Reemplaza todos los datos actuales de este navegador.', confirmar: 'Importar', peligro: true })) return;
        this._importarTexto(texto);
      });
    }
  };

  AQ.App = App;

  // ---------- Arranque ----------
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      const raiz = document.getElementById('app');
      const avisos = document.getElementById('avisos');
      const dialogo = document.getElementById('dialogo');
      let store;
      let sinGuardado = false;
      try {
        // Fase 2: cambiar esta línea por otro repositorio (por ejemplo, uno en la nube).
        // La clave conserva el nombre viejo de la app a propósito: cambiarla haría perder los datos ya guardados.
        const repo = new AQ.LocalStorageRepository('agendaquest.v1');
        try {
          repo.almacenamiento.setItem('agendaquest.prueba', '1');
          repo.almacenamiento.removeItem('agendaquest.prueba');
        } catch (e) {
          throw new AQ.ErrorAlmacenamiento('sin-acceso');
        }
        store = new AQ.Store(repo);
      } catch (e) {
        if (e.message === 'sin-acceso') {
          // El navegador no deja guardar (ventana privada, visor bloqueado): funciona igual, sin memoria.
          store = new AQ.Store(new AQ.MemoryRepository());
          sinGuardado = true;
        } else {
          raiz.innerHTML = '<main class="pantalla centrada"><h1 class="titulo-pixel">No se pudieron cargar los datos</h1><p class="texto-suave">' +
            AQ.util.esc(e.message) + '</p></main>';
          return;
        }
      }
      const app = new App(store, raiz, avisos, dialogo);
      AQ.app = app;
      app.iniciar();
      if (sinGuardado) app.aviso('Este navegador no deja guardar datos: lo que cargues se pierde al cerrar.', 'error');
    });
  }
})(globalThis.AQ = globalThis.AQ || {});
