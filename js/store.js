/*
 * store.js — El "modelo" de la app: todas las operaciones sobre los datos.
 *
 * - Las pantallas nunca modifican el estado directamente: llaman a métodos del Store.
 * - Cada operación pasa por _confirmar(), que guarda con el repositorio y avisa
 *   a los suscriptores (patrón Observer) para que la pantalla se vuelva a dibujar.
 * - Si guardar falla (por ejemplo, sin espacio), el cambio se deshace.
 */
(function (AQ) {
  'use strict';

  const { Fecha, util, reglas } = AQ;
  const M = reglas.MONEDAS;

  class ErrorValidacion extends Error {}

  function exigir(condicion, mensaje) {
    if (!condicion) throw new ErrorValidacion(mensaje);
  }

  function textoLimpio(valor, max) {
    return String(valor == null ? '' : valor).trim().slice(0, max || 200);
  }

  class Store {
    constructor(repositorio, plan) {
      this.repo = repositorio;
      this.plan = plan || new AQ.PlanEspaciado();
      this.estado = repositorio.cargar();
      this.suscriptores = [];
    }

    // ---------- Observer ----------
    suscribir(fn) { this.suscriptores.push(fn); }
    _avisar(evento) { this.suscriptores.forEach((fn) => fn(evento)); }

    _confirmar(evento, mutacion) {
      const copia = JSON.stringify(this.estado);
      let resultado;
      try {
        resultado = mutacion();
        this.repo.guardar(this.estado);
      } catch (e) {
        this.estado = JSON.parse(copia);
        throw e;
      }
      this._avisar(evento);
      return resultado;
    }

    _movimiento(perfilId, cantidad, motivo, ref, tipo) {
      this.estado.movimientos.push({
        id: util.nuevoId(), perfilId, cantidad, motivo, ref: ref || null, tipo: tipo || 'otro', fecha: Fecha.hoy()
      });
    }

    // ---------- PIN del padre ----------
    tienePin() { return !!this.estado.pinHash; }

    configurarPin(pin) {
      exigir(/^\d{4}$/.test(pin), 'El PIN tiene que ser de 4 números.');
      return this._confirmar('pin', () => { this.estado.pinHash = util.hashPin(pin); });
    }

    verificarPin(pin) { return !!this.estado.pinHash && util.hashPin(pin) === this.estado.pinHash; }

    cambiarPin(actual, nuevo) {
      exigir(this.verificarPin(actual), 'El PIN actual no es correcto.');
      return this.configurarPin(nuevo);
    }

    // ---------- Perfiles ----------
    get perfiles() { return this.estado.perfiles; }
    perfil(id) { return this.estado.perfiles.find((p) => p.id === id) || null; }

    agregarPerfil(datos) {
      const nombre = textoLimpio(datos.nombre, 40);
      exigir(nombre, 'Poné el nombre del estudiante.');
      return this._confirmar('perfiles', () => {
        const p = {
          id: util.nuevoId(),
          nombre,
          anio: textoLimpio(datos.anio, 20),
          creado: Fecha.hoy(),
          mascota: { nombre: textoLimpio(datos.mascota, 20) || 'Brote', color: 'lima', fondo: 'ninguno', colores: ['lima'], fondos: ['ninguno'] },
          bonosSemana: [],
          revision: { ultima: null, racha: 0 },
          vida: { valor: reglas.VIDA.MAX, revisadoHasta: Fecha.sumarDias(Fecha.hoy(), -1), comioEl: null, vacaciones: false },
          ajustes: AQ.Repositorio.ajustesBase()
        };
        this.estado.perfiles.push(p);
        return p;
      });
    }

    editarPerfil(id, datos) {
      const p = this.perfil(id);
      exigir(p, 'Perfil no encontrado.');
      const nombre = textoLimpio(datos.nombre, 40);
      exigir(nombre, 'Poné el nombre del estudiante.');
      return this._confirmar('perfiles', () => {
        p.nombre = nombre;
        p.anio = textoLimpio(datos.anio, 20);
        if (datos.mascota != null) p.mascota.nombre = textoLimpio(datos.mascota, 20) || p.mascota.nombre;
      });
    }

    eliminarPerfil(id) {
      return this._confirmar('perfiles', () => {
        const e = this.estado;
        e.perfiles = e.perfiles.filter((p) => p.id !== id);
        ['materias', 'tareas', 'examenes', 'movimientos', 'canjes', 'pomodoros'].forEach((k) => {
          e[k] = e[k].filter((x) => x.perfilId !== id);
        });
      });
    }

    // ---------- Materias ----------
    materiasDe(perfilId) {
      return this.estado.materias.filter((m) => m.perfilId === perfilId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    materia(id) { return this.estado.materias.find((m) => m.id === id) || null; }

    agregarMateria(perfilId, datos) {
      const nombre = textoLimpio(datos.nombre, 30);
      exigir(nombre, 'Poné el nombre de la materia.');
      exigir(!this.materiasDe(perfilId).some((m) => m.nombre.toLowerCase() === nombre.toLowerCase()), 'Ya tenés una materia con ese nombre.');
      return this._confirmar('materias', () => {
        const usadas = this.materiasDe(perfilId).length;
        const m = {
          id: util.nuevoId(), perfilId, nombre,
          color: datos.color || reglas.COLORES_MATERIA[usadas % reglas.COLORES_MATERIA.length],
          profesor: textoLimpio(datos.profesor, 40)
        };
        this.estado.materias.push(m);
        return m;
      });
    }

    editarMateria(id, datos) {
      const m = this.materia(id);
      exigir(m, 'Materia no encontrada.');
      const nombre = textoLimpio(datos.nombre, 30);
      exigir(nombre, 'Poné el nombre de la materia.');
      return this._confirmar('materias', () => {
        m.nombre = nombre;
        m.color = datos.color || m.color;
        m.profesor = textoLimpio(datos.profesor, 40);
      });
    }

    eliminarMateria(id) {
      const usada = this.estado.tareas.some((t) => t.materiaId === id && t.estado !== 'aprobada')
        || this.estado.examenes.some((x) => x.materiaId === id && Fecha.diferencia(Fecha.hoy(), x.fecha) >= 0);
      exigir(!usada, 'Esta materia tiene tareas o exámenes pendientes. Terminalos o borralos primero.');
      return this._confirmar('materias', () => {
        this.estado.materias = this.estado.materias.filter((m) => m.id !== id);
      });
    }

    // ---------- Tareas ----------
    tarea(id) { return this.estado.tareas.find((t) => t.id === id) || null; }
    tareasDe(perfilId) { return this.estado.tareas.filter((t) => t.perfilId === perfilId); }

    agregarTarea(perfilId, datos, porPadre) {
      const titulo = textoLimpio(datos.titulo, 120);
      exigir(this.perfil(perfilId), 'Perfil no encontrado.');
      exigir(this.materia(datos.materiaId), 'Elegí una materia.');
      exigir(titulo, 'Escribí qué hay que hacer.');
      exigir(Fecha.esValida(datos.vence), 'Elegí la fecha de entrega.');
      return this._confirmar('tareas', () => {
        const t = {
          id: util.nuevoId(), perfilId, tipo: 'tarea',
          materiaId: datos.materiaId, titulo,
          detalle: textoLimpio(datos.detalle, 500),
          vence: datos.vence, creada: Fecha.hoy(),
          creadaPor: porPadre ? 'padre' : 'estudiante',
          estado: 'pendiente', enviadaEl: null, aprobadaEl: null, nota: '',
          foto: datos.foto || null, examenId: null
        };
        const nace = this.tareasDe(perfilId).length === 0;
        this.estado.tareas.push(t);
        if (nace) {
          // La mascota nace con vida completa; el hambre empieza a contar desde mañana.
          const p = this.perfil(perfilId);
          p.vida.valor = reglas.VIDA.MAX;
          p.vida.revisadoHasta = Fecha.hoy();
        }
        if (!porPadre) this._movimiento(perfilId, M.ANOTAR, 'Anotaste: ' + titulo, t.id, 'anotar');
        return t;
      });
    }

    editarTarea(id, datos) {
      const t = this.tarea(id);
      exigir(t, 'Tarea no encontrada.');
      exigir(t.estado !== 'aprobada', 'Una tarea aprobada ya no se puede cambiar.');
      if (datos.vence != null) exigir(Fecha.esValida(datos.vence), 'Fecha inválida.');
      if (datos.titulo != null) exigir(textoLimpio(datos.titulo), 'Escribí qué hay que hacer.');
      return this._confirmar('tareas', () => {
        if (datos.titulo != null) t.titulo = textoLimpio(datos.titulo, 120);
        if (datos.detalle != null) t.detalle = textoLimpio(datos.detalle, 500);
        if (datos.vence != null) t.vence = datos.vence;
        if (datos.materiaId && this.materia(datos.materiaId) && t.tipo === 'tarea') t.materiaId = datos.materiaId;
        if ('foto' in datos) t.foto = datos.foto;
      });
    }

    marcarHecha(id) {
      const t = this.tarea(id);
      exigir(t && t.estado === 'pendiente', 'Esta tarea no está pendiente.');
      return this._confirmar('tareas', () => {
        t.estado = 'enviada';
        t.enviadaEl = Fecha.hoy();
        t.nota = '';
      });
    }

    desmarcar(id) {
      const t = this.tarea(id);
      exigir(t && t.estado === 'enviada', 'Esta tarea no está esperando aprobación.');
      return this._confirmar('tareas', () => {
        t.estado = 'pendiente';
        t.enviadaEl = null;
      });
    }

    /** El padre aprueba: recién ahí se acreditan las monedas. */
    aprobar(id) {
      const t = this.tarea(id);
      exigir(t && t.estado === 'enviada', 'Esta tarea no está esperando aprobación.');
      return this._confirmar('tareas', () => {
        let cantidad, motivo;
        if (t.tipo === 'sesion') {
          cantidad = M.SESION; motivo = 'Sesión de estudio: ' + t.titulo;
        } else if (Fecha.diferencia(t.enviadaEl, t.vence) >= 0) {
          cantidad = M.A_TIEMPO; motivo = 'A tiempo: ' + t.titulo;
        } else {
          cantidad = M.TARDE; motivo = 'Terminada tarde: ' + t.titulo;
        }
        t.estado = 'aprobada';
        t.aprobadaEl = Fecha.hoy();
        this._movimiento(t.perfilId, cantidad, motivo, t.id, 'aprobacion');
        return cantidad;
      });
    }

    devolver(id, nota) {
      const t = this.tarea(id);
      exigir(t && t.estado === 'enviada', 'Esta tarea no está esperando aprobación.');
      return this._confirmar('tareas', () => {
        t.estado = 'pendiente';
        t.enviadaEl = null;
        t.nota = textoLimpio(nota, 200) || 'Revisala de nuevo.';
      });
    }

    /** Borrar una tarea no aprobada. Si daba monedas por anotarla, se descuentan. */
    eliminarTarea(id) {
      const t = this.tarea(id);
      exigir(t, 'Tarea no encontrada.');
      exigir(t.estado !== 'aprobada', 'Una tarea aprobada no se puede borrar.');
      return this._confirmar('tareas', () => {
        const premio = this.estado.movimientos.find((m) => m.ref === t.id && m.tipo === 'anotar');
        if (premio) this._movimiento(t.perfilId, -premio.cantidad, 'Tarea borrada: ' + t.titulo, t.id, 'ajuste');
        this.estado.tareas = this.estado.tareas.filter((x) => x.id !== id);
      });
    }

    borrarFotosAprobadas() {
      return this._confirmar('tareas', () => {
        let n = 0;
        this.estado.tareas.forEach((t) => { if (t.foto && t.estado === 'aprobada') { t.foto = null; n++; } });
        return n;
      });
    }

    // ---------- Exámenes ----------
    examen(id) { return this.estado.examenes.find((x) => x.id === id) || null; }
    examenesDe(perfilId) {
      return this.estado.examenes.filter((x) => x.perfilId === perfilId).sort((a, b) => a.fecha.localeCompare(b.fecha));
    }
    sesionesDe(examenId) {
      return this.estado.tareas.filter((t) => t.examenId === examenId).sort((a, b) => a.vence.localeCompare(b.vence));
    }

    previsualizarPlan(fecha) {
      if (!Fecha.esValida(fecha)) return [];
      return this.plan.generar(fecha, Fecha.hoy());
    }

    agregarExamen(perfilId, datos) {
      exigir(this.materia(datos.materiaId), 'Elegí una materia.');
      exigir(Fecha.esValida(datos.fecha), 'Elegí la fecha del examen.');
      exigir(Fecha.diferencia(Fecha.hoy(), datos.fecha) >= 0, 'La fecha del examen ya pasó.');
      return this._confirmar('examenes', () => {
        const x = {
          id: util.nuevoId(), perfilId, materiaId: datos.materiaId, fecha: datos.fecha,
          temas: textoLimpio(datos.temas, 200), nota: ''
        };
        this.estado.examenes.push(x);
        this.plan.generar(x.fecha, Fecha.hoy()).forEach((s) => {
          this.estado.tareas.push({
            id: util.nuevoId(), perfilId, tipo: 'sesion', materiaId: x.materiaId,
            titulo: s.titulo, detalle: x.temas, vence: s.fecha, creada: Fecha.hoy(), creadaPor: 'app',
            estado: 'pendiente', enviadaEl: null, aprobadaEl: null, nota: '', foto: null, examenId: x.id
          });
        });
        return x;
      });
    }

    editarExamen(id, datos) {
      const x = this.examen(id);
      exigir(x, 'Examen no encontrado.');
      return this._confirmar('examenes', () => {
        if (datos.temas != null) x.temas = textoLimpio(datos.temas, 200);
        if (datos.nota != null) x.nota = textoLimpio(datos.nota, 10);
      });
    }

    /** Borra el examen y las sesiones que todavía no se aprobaron. */
    eliminarExamen(id) {
      return this._confirmar('examenes', () => {
        this.estado.examenes = this.estado.examenes.filter((x) => x.id !== id);
        this.estado.tareas = this.estado.tareas.filter((t) => !(t.examenId === id && t.estado !== 'aprobada'));
      });
    }

    // ---------- Monedas ----------
    movimientosDe(perfilId) {
      return this.estado.movimientos.filter((m) => m.perfilId === perfilId);
    }
    saldo(perfilId) { return this.movimientosDe(perfilId).reduce((s, m) => s + m.cantidad, 0); }
    /** Experiencia: monedas ganadas (sin contar gastos, reintegros ni descuentos por tareas borradas). */
    xp(perfilId) {
      const movs = this.movimientosDe(perfilId);
      const ganadas = movs.filter((m) => m.cantidad > 0 && m.tipo !== 'reintegro').reduce((s, m) => s + m.cantidad, 0);
      const descontadas = movs.filter((m) => m.tipo === 'ajuste').reduce((s, m) => s - m.cantidad, 0);
      return ganadas - descontadas;
    }
    nivel(perfilId) { return reglas.nivelDesdeXp(Math.max(0, this.xp(perfilId))); }

    // ---------- Configuración del estudiante ----------
    ajustes(perfilId) {
      const p = this.perfil(perfilId);
      return p ? p.ajustes : AQ.Repositorio.ajustesBase();
    }

    /** Cambia preferencias validando cada valor. */
    editarAjustes(perfilId, cambios) {
      const p = this.perfil(perfilId);
      exigir(p, 'Perfil no encontrado.');
      const a = Object.assign({}, p.ajustes);
      if ('letra' in cambios) { exigir(['normal', 'grande', 'muy-grande'].includes(cambios.letra), 'Tamaño de letra inválido.'); a.letra = cambios.letra; }
      if ('foco' in cambios) { exigir(AQ.pomodoro.OPCIONES_FOCO.includes(Number(cambios.foco)), 'Duración inválida.'); a.foco = Number(cambios.foco); }
      if ('descanso' in cambios) { exigir(AQ.pomodoro.OPCIONES_DESCANSO.includes(Number(cambios.descanso)), 'Duración inválida.'); a.descanso = Number(cambios.descanso); }
      ['sonido', 'animaciones'].forEach((k) => { if (k in cambios) a[k] = !!cambios[k]; });
      return this._confirmar('ajustes', () => { p.ajustes = a; });
    }

    renombrarMascota(perfilId, nombre) {
      const p = this.perfil(perfilId);
      const limpio = textoLimpio(nombre, 20);
      exigir(p, 'Perfil no encontrado.');
      exigir(limpio, 'Escribí un nombre para tu mascota.');
      return this._confirmar('perfiles', () => { p.mascota.nombre = limpio; });
    }

    // ---------- Vida y comida de la mascota ----------
    /**
     * Revisa los días que pasaron desde la última vez: cada día sin comer resta 1 de vida.
     * No cuenta mientras la mascota es un huevo ni con el modo vacaciones activo.
     * Solo guarda si algo cambió. Devuelve cuántos puntos de vida perdió.
     */
    actualizarVida(perfilId) {
      const p = this.perfil(perfilId);
      if (!p) return 0;
      const v = p.vida;
      const ayer = Fecha.sumarDias(Fecha.hoy(), -1);
      if (!v.revisadoHasta) v.revisadoHasta = ayer;
      if (v.revisadoHasta >= ayer) return 0;
      const nacida = this.tareasDe(perfilId).length > 0;
      return this._confirmar('vida', () => {
        let perdidas = 0;
        if (nacida && !v.vacaciones) {
          let dia = Fecha.sumarDias(v.revisadoHasta, 1);
          while (dia <= ayer) {
            if (v.comioEl !== dia && v.valor > 0) { v.valor -= 1; perdidas += 1; }
            dia = Fecha.sumarDias(dia, 1);
          }
        }
        v.revisadoHasta = ayer;
        return perdidas;
      });
    }

    comioHoy(perfilId) {
      const p = this.perfil(perfilId);
      return !!p && p.vida.comioEl === Fecha.hoy();
    }

    /** Darle de comer: cuesta monedas, una vez por día, y devuelve 1 de vida. */
    alimentar(perfilId) {
      const p = this.perfil(perfilId);
      exigir(p, 'Perfil no encontrado.');
      exigir(this.tareasDe(perfilId).length > 0, 'Todavía es un huevo: anotá tu primera tarea para que nazca.');
      exigir(!this.comioHoy(perfilId), 'Ya comió hoy. Mañana tiene hambre de nuevo.');
      const costo = reglas.VIDA.COSTO_COMIDA;
      exigir(this.saldo(perfilId) >= costo, 'Te faltan monedas para la comida. Terminá una tarea y volvé.');
      return this._confirmar('vida', () => {
        p.vida.comioEl = Fecha.hoy();
        const antes = p.vida.valor;
        p.vida.valor = Math.min(reglas.VIDA.MAX, p.vida.valor + 1);
        this._movimiento(perfilId, -costo, 'Comida para ' + p.mascota.nombre, null, 'comida');
        return p.vida.valor - antes;
      });
    }

    /** Modo vacaciones: la mascota no pierde vida mientras está activo (lo maneja el padre). */
    ponerVacaciones(perfilId, activo) {
      const p = this.perfil(perfilId);
      exigir(p, 'Perfil no encontrado.');
      return this._confirmar('vida', () => {
        p.vida.vacaciones = !!activo;
        // Hoy no se cuenta: el cambio rige desde mañana.
        p.vida.revisadoHasta = Fecha.hoy();
      });
    }

    // ---------- Pomodoro ----------
    /**
     * Registra un pomodoro completo. Da 1 moneda cada 5 minutos de foco,
     * con un tope diario para que no convenga dejar el reloj corriendo solo.
     * Devuelve las monedas acreditadas (puede ser 0 si ya llegó al tope).
     */
    registrarPomodoro(perfilId, minutos, tareaId) {
      exigir(this.perfil(perfilId), 'Perfil no encontrado.');
      exigir(minutos > 0 && minutos <= 60, 'Duración inválida.');
      const hoy = Fecha.hoy();
      const yaHoy = this.estado.movimientos.filter((m) => m.perfilId === perfilId && m.tipo === 'pomodoro' && m.fecha === hoy)
        .reduce((s, m) => s + m.cantidad, 0);
      const base = Math.floor(minutos / 5) * M.POMODORO_POR_5_MIN;
      const cantidad = Math.max(0, Math.min(base, M.TOPE_POMODORO_DIA - yaHoy));
      return this._confirmar('pomodoro', () => {
        const t = tareaId ? this.tarea(tareaId) : null;
        this.estado.pomodoros.push({ id: util.nuevoId(), perfilId, fecha: hoy, minutos, tareaId: t ? t.id : null });
        if (cantidad > 0) this._movimiento(perfilId, cantidad, 'Pomodoro de ' + minutos + ' min' + (t ? ': ' + t.titulo : ''), null, 'pomodoro');
        return cantidad;
      });
    }

    /** Pomodoros completos y minutos de foco en los últimos `dias` días (incluye hoy). */
    estudio(perfilId, dias) {
      const desde = Fecha.sumarDias(Fecha.hoy(), -(dias - 1));
      const lista = this.estado.pomodoros.filter((p) => p.perfilId === perfilId && p.fecha >= desde);
      return { pomodoros: lista.length, minutos: lista.reduce((s, p) => s + p.minutos, 0) };
    }

    monedasPomodoroHoy(perfilId) {
      const hoy = Fecha.hoy();
      return this.estado.movimientos.filter((m) => m.perfilId === perfilId && m.tipo === 'pomodoro' && m.fecha === hoy)
        .reduce((s, m) => s + m.cantidad, 0);
    }

    // ---------- Premios y canjes ----------
    get premios() { return this.estado.premios; }

    agregarPremio(datos) {
      const nombre = textoLimpio(datos.nombre, 60);
      const precio = Math.round(Number(datos.precio));
      exigir(nombre, 'Poné el nombre del premio.');
      exigir(precio > 0 && precio <= 100000, 'El precio tiene que ser un número mayor que 0.');
      return this._confirmar('premios', () => {
        const p = { id: util.nuevoId(), nombre, precio, activo: true };
        this.estado.premios.push(p);
        return p;
      });
    }

    editarPremio(id, datos) {
      const p = this.estado.premios.find((x) => x.id === id);
      exigir(p, 'Premio no encontrado.');
      const precio = Math.round(Number(datos.precio));
      exigir(textoLimpio(datos.nombre), 'Poné el nombre del premio.');
      exigir(precio > 0, 'El precio tiene que ser mayor que 0.');
      return this._confirmar('premios', () => { p.nombre = textoLimpio(datos.nombre, 60); p.precio = precio; });
    }

    eliminarPremio(id) {
      return this._confirmar('premios', () => {
        this.estado.premios = this.estado.premios.filter((x) => x.id !== id);
      });
    }

    canjear(perfilId, premioId) {
      const p = this.estado.premios.find((x) => x.id === premioId);
      exigir(p, 'Ese premio ya no está disponible.');
      exigir(this.saldo(perfilId) >= p.precio, 'Todavía no te alcanzan las monedas.');
      return this._confirmar('canjes', () => {
        const c = { id: util.nuevoId(), perfilId, premioId, nombre: p.nombre, precio: p.precio, fecha: Fecha.hoy(), entregado: false };
        this.estado.canjes.push(c);
        this._movimiento(perfilId, -p.precio, 'Canjeaste: ' + p.nombre, c.id, 'canje');
        return c;
      });
    }

    canjesDe(perfilId) { return this.estado.canjes.filter((c) => c.perfilId === perfilId); }

    marcarEntregado(canjeId) {
      const c = this.estado.canjes.find((x) => x.id === canjeId);
      exigir(c, 'Canje no encontrado.');
      return this._confirmar('canjes', () => { c.entregado = true; });
    }

    /** El padre cancela un canje y devuelve las monedas. */
    cancelarCanje(canjeId) {
      const c = this.estado.canjes.find((x) => x.id === canjeId);
      exigir(c && !c.entregado, 'Ese canje ya fue entregado.');
      return this._confirmar('canjes', () => {
        this._movimiento(c.perfilId, c.precio, 'Canje cancelado: ' + c.nombre, c.id, 'reintegro');
        this.estado.canjes = this.estado.canjes.filter((x) => x.id !== canjeId);
      });
    }

    // ---------- Cosméticos de la mascota ----------
    comprarCosmetico(perfilId, tipo, id) {
      const perfil = this.perfil(perfilId);
      const item = (reglas.COSMETICOS[tipo] || []).find((x) => x.id === id);
      exigir(perfil && item, 'Ítem no encontrado.');
      const lista = perfil.mascota[tipo];
      exigir(!lista.includes(id), 'Ya lo tenés.');
      exigir(this.saldo(perfilId) >= item.precio, 'Todavía no te alcanzan las monedas.');
      return this._confirmar('mascota', () => {
        lista.push(id);
        this._movimiento(perfilId, -item.precio, 'Compraste para tu mascota: ' + item.nombre, id, 'compra');
        this._equipar(perfil, tipo, id);
      });
    }

    equipar(perfilId, tipo, id) {
      const perfil = this.perfil(perfilId);
      exigir(perfil && perfil.mascota[tipo].includes(id), 'Todavía no lo compraste.');
      return this._confirmar('mascota', () => this._equipar(perfil, tipo, id));
    }

    _equipar(perfil, tipo, id) {
      if (tipo === 'colores') perfil.mascota.color = id;
      if (tipo === 'fondos') perfil.mascota.fondo = id;
    }

    // ---------- Revisión diaria y bonos ----------
    /** El padre registra que hoy revisaron la agenda juntos. Cada 5 días seguidos da un bono. */
    registrarRevision(perfilId) {
      const p = this.perfil(perfilId);
      exigir(p, 'Perfil no encontrado.');
      const hoy = Fecha.hoy();
      exigir(p.revision.ultima !== hoy, 'La revisión de hoy ya está registrada.');
      return this._confirmar('revision', () => {
        const ayer = Fecha.sumarDias(hoy, -1);
        p.revision.racha = p.revision.ultima === ayer ? p.revision.racha + 1 : 1;
        p.revision.ultima = hoy;
        let bono = 0;
        if (p.revision.racha % 5 === 0) {
          bono = M.RACHA_REVISION;
          this._movimiento(perfilId, bono, 'Revisión diaria: ' + p.revision.racha + ' días seguidos', null, 'bono');
        }
        return { racha: p.revision.racha, bono };
      });
    }

    rachaRevision(perfilId) {
      const p = this.perfil(perfilId);
      if (!p || !p.revision.ultima) return 0;
      const dif = Fecha.diferencia(p.revision.ultima, Fecha.hoy());
      return dif <= 1 ? p.revision.racha : 0;
    }

    /**
     * Revisa las semanas completas (lunes a domingo) que terminaron y todavía no se evaluaron.
     * Si hubo al menos una tarea en la semana y todas se marcaron como hechas a tiempo, da el bono.
     * Devuelve cuántas monedas se dieron.
     */
    evaluarSemanas(perfilId) {
      const p = this.perfil(perfilId);
      if (!p) return 0;
      const hoy = Fecha.hoy();
      let inicio = Fecha.lunes(p.creado);
      if (inicio !== p.creado) inicio = Fecha.sumarDias(inicio, 7);
      const pendientes = [];
      while (Fecha.diferencia(Fecha.sumarDias(inicio, 6), hoy) > 0) {
        if (!p.bonosSemana.includes(inicio)) pendientes.push(inicio);
        inicio = Fecha.sumarDias(inicio, 7);
      }
      if (pendientes.length === 0) return 0;
      return this._confirmar('bonos', () => {
        let total = 0;
        pendientes.forEach((lunes) => {
          const domingo = Fecha.sumarDias(lunes, 6);
          const deLaSemana = this.tareasDe(perfilId).filter((t) => t.tipo === 'tarea' && t.vence >= lunes && t.vence <= domingo);
          const limpia = deLaSemana.length > 0 && deLaSemana.every((t) => t.enviadaEl && t.enviadaEl <= t.vence);
          if (limpia) {
            total += M.SEMANA_LIMPIA;
            this._movimiento(perfilId, M.SEMANA_LIMPIA, 'Semana sin vencidas (' + Fecha.numeroDia(lunes) + ' al ' + Fecha.numeroDia(domingo) + ' de ' + Fecha.nombreMes(domingo) + ')', lunes, 'bono');
          }
          p.bonosSemana.push(lunes);
        });
        return total;
      });
    }

    // ---------- Resúmenes para pantallas ----------
    resumen(perfilId) {
      const hoy = Fecha.hoy();
      const manana = Fecha.sumarDias(hoy, 1);
      const hace7 = Fecha.sumarDias(hoy, -7);
      const tareas = this.tareasDe(perfilId);
      const pend = tareas.filter((t) => t.estado === 'pendiente');
      return {
        pendientes: pend.length,
        vencidas: pend.filter((t) => t.vence < hoy).length,
        urgentes: pend.filter((t) => t.vence === hoy || t.vence === manana).length,
        porAprobar: tareas.filter((t) => t.estado === 'enviada').length,
        sesionesSemana: tareas.filter((t) => t.tipo === 'sesion' && t.enviadaEl && t.enviadaEl >= hace7).length,
        rachaRevision: this.rachaRevision(perfilId),
        pomodorosSemana: this.estudio(perfilId, 7).pomodoros,
        vida: this.perfil(perfilId).vida.valor,
        comioHoy: this.comioHoy(perfilId),
        vacaciones: this.perfil(perfilId).vida.vacaciones,
        saldo: this.saldo(perfilId),
        tieneTareas: tareas.length > 0
      };
    }

    mascota(perfilId) {
      const p = this.perfil(perfilId);
      const r = this.resumen(perfilId);
      const nivel = this.nivel(perfilId);
      const base = reglas.estadoMascota(r);
      return Object.assign(base, {
        nombre: p.mascota.nombre,
        nivel,
        xp: Math.max(0, this.xp(perfilId)),
        etapa: reglas.etapa(nivel, r.tieneTareas),
        color: reglas.color(p.mascota.color),
        fondo: reglas.fondo(p.mascota.fondo),
        vida: r.vida,
        comioHoy: r.comioHoy,
        vacaciones: r.vacaciones,
        resumen: r
      });
    }

    /**
     * Porcentaje de tareas entregadas a tiempo entre las que vencían en los últimos `dias` días.
     * Devuelve null si no hay tareas en ese período.
     */
    aTiempo(perfilId, dias, materiaId) {
      const hoy = Fecha.hoy();
      const desde = Fecha.sumarDias(hoy, -dias);
      const lista = this.tareasDe(perfilId).filter((t) => t.tipo === 'tarea' && t.vence >= desde && t.vence < hoy
        && (!materiaId || t.materiaId === materiaId));
      if (lista.length === 0) return null;
      const ok = lista.filter((t) => t.enviadaEl && t.enviadaEl <= t.vence).length;
      return { pct: Math.round(100 * ok / lista.length), total: lista.length, ok };
    }

    // ---------- Copia de seguridad ----------
    exportar() {
      return JSON.stringify(Object.assign({ exportado: new Date().toISOString(), app: AQ.NOMBRE_APP }, this.estado), null, 2);
    }

    importar(texto) {
      let datos;
      try { datos = JSON.parse(texto); } catch (e) { throw new ErrorValidacion('El archivo no es una copia de seguridad válida.'); }
      exigir(datos && Array.isArray(datos.perfiles), 'El archivo no es una copia de seguridad válida.');
      delete datos.exportado; delete datos.app;
      const normal = AQ.Repositorio.normalizar(datos);
      return this._confirmar('importar', () => { this.estado = normal; });
    }

    borrarTodo() {
      return this._confirmar('importar', () => { this.estado = AQ.estadoVacio(); });
    }

    tamanioDatos() { return JSON.stringify(this.estado).length; }
  }

  AQ.Store = Store;
  AQ.ErrorValidacion = ErrorValidacion;
})(globalThis.AQ = globalThis.AQ || {});
