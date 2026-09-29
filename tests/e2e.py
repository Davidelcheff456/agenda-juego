"""
Prueba de punta a punta en un navegador real (Chromium headless).
Uso: python3 tests/e2e.py  -> guarda capturas en tests/capturas/
"""
import os, sys, pathlib
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
URL = (RAIZ / 'index.html').as_uri()
CAP = RAIZ / 'tests' / 'capturas'
CAP.mkdir(exist_ok=True)
errores = []

def foto(page, nombre):
    page.evaluate("document.getElementById('avisos').innerHTML = ''")
    page.screenshot(path=str(CAP / (nombre + '.png')), full_page=True)

def paso(nombre):
    print('->', nombre)

with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2)
    page = ctx.new_page()
    page.route('**/fonts.googleapis.com/**', lambda r: r.abort())
    page.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    page.on('console', lambda m: errores.append(m.text) if m.type == 'error' and 'ERR_FAILED' not in m.text else None)
    page.on('pageerror', lambda e: errores.append(str(e)))
    page.on('dialog', lambda d: errores.append('diálogo nativo: ' + d.message) or d.dismiss())
    page.goto(URL)

    paso('bienvenida y PIN')
    foto(page, '01-bienvenida')
    page.fill('#pin1', '1234'); page.fill('#pin2', '1234')
    page.click('text=Crear PIN y seguir')
    paso('primer perfil')
    page.fill('#nombre', 'Tomi'); page.fill('#anio', '1.º año'); page.fill('#mascota', 'Brote')
    page.click('button:has-text("Crear perfil")')
    page.wait_for_selector('.tarjeta-perfil')
    foto(page, '02-perfiles')

    paso('entrar y cargar materias')
    page.click('.tarjeta-perfil')
    page.click('text=Agregar materias')
    for nombre in ['Matemática', 'Lengua', 'Historia']:
        page.fill('#nombre', nombre)
        page.click('button:has-text("Agregar y cargar otra")')
    page.fill('#nombre', 'Biología')
    page.click('button:has-text("Agregar materia")')
    page.wait_for_selector('text=Materias')

    paso('anotar tareas')
    page.click('.nav-item:has-text("Hoy")')
    foto(page, '03-hoy-huevo')
    page.click('.fab')
    page.fill('#titulo', 'Ejercicios 12 a 20, página 45')
    page.click('button.chip:has-text("Mañana")')
    foto(page, '04-nueva-tarea')
    page.click('button:has-text("Anotar tarea")')
    page.wait_for_selector('text=Ejercicios 12 a 20')
    page.click('.fab')
    page.click('.chip-radio:has-text("Lengua")')
    page.fill('#titulo', 'Leer el cuento y responder la guía')
    page.fill('#vence', page.evaluate("AQ.Fecha.sumarDias(AQ.Fecha.hoy(), 3)"))
    page.click('button:has-text("Anotar tarea")')
    page.click('.fab')
    page.click('.chip-radio:has-text("Historia")')
    page.fill('#titulo', 'Cuestionario del capítulo 3')
    page.fill('#vence', page.evaluate("AQ.Fecha.sumarDias(AQ.Fecha.hoy(), -1)"))
    page.click('button:has-text("Anotar tarea")')
    page.wait_for_selector('.fila-tarea.vencida')
    foto(page, '05-hoy-con-tareas')
    assert '15' in page.inner_text('.pastilla-monedas'), 'debería tener 15 monedas'

    paso('todavía es un huevo')
    page.wait_for_selector('text=Soy un huevo')
    assert page.locator('button:has-text("Darle de comer")').count() == 0

    paso('marcar hecha')
    page.click('.fila-tarea:has-text("Ejercicios 12") .casillero')
    page.wait_for_selector('text=Falta que papá la valide')
    assert page.inner_text('.pastilla-monedas').strip() == '18', 'marcar hecha debe dar +3'
    foto(page, '06-mascota-feliz')

    paso('detalle y editar')
    page.click('.fila-tarea:has-text("Leer el cuento") .fila-cuerpo')
    page.wait_for_selector('.titulo-detalle')
    page.click('button:has-text("Editar")')
    page.fill('#detalle', 'Cuento de la página 30')
    page.click('button:has-text("Guardar cambios")')
    page.wait_for_selector('.titulo-detalle')
    assert 'Cuento de la página 30' in page.inner_text('.detalle')
    page.click('[data-accion="atras"]')

    paso('borrar tarea propia')
    page.click('.fab')
    page.fill('#titulo', 'Tarea de prueba para borrar')
    page.click('button:has-text("Anotar tarea")')
    page.click('.fila-tarea:has-text("Tarea de prueba") .fila-cuerpo')
    page.click('button:has-text("Borrar")')
    page.keyboard.press('Escape')
    assert page.locator('.titulo-detalle').count() == 1
    page.click('button:has-text("Borrar")')
    page.click('#dialogo [data-dialogo="si"]')
    page.wait_for_selector('text=Hola, Tomi')
    assert page.locator('text=Tarea de prueba').count() == 0

    paso('examen')
    page.click('.nav-item:has-text("Exámenes")')
    page.click('text=Agendar examen')
    page.fill('#temas', 'Ecuaciones')
    page.fill('#fecha', page.evaluate("AQ.Fecha.sumarDias(AQ.Fecha.hoy(), 7)"))
    page.dispatch_event('#fecha', 'change')
    assert page.locator('#plan-preview li').count() == 4
    foto(page, '07-examen-form')
    page.click('button:has-text("Guardar examen")')
    page.wait_for_selector('text=Sesiones de estudio')
    foto(page, '08-examen')
    page.click('[data-accion="atras"]')
    page.click('.nav-item:has-text("Hoy")')
    foto(page, '09-hoy-completo')

    paso('pomodoro')
    saldo_antes = int(page.inner_text('.pastilla-monedas').strip())
    page.click('.nav-item:has-text("Pomodoro")')
    page.click('.chip-tiempo:has-text("15")')
    page.click('.grilla-tiempos.tres .chip-tiempo:has-text("10")')
    foto(page, '14-pomodoro-elegir')
    page.click('button:has-text("Empezar")')
    t = page.inner_text('#pomo-tiempo')
    assert t in ('15:00', '14:59'), t
    page.wait_for_timeout(2500)
    assert page.inner_text('#pomo-tiempo') != '15:00'
    foto(page, '15-pomodoro-foco')
    page.click('button:has-text("Pausar")')
    pausa = page.inner_text('#pomo-tiempo'); page.wait_for_timeout(1300)
    assert page.inner_text('#pomo-tiempo') == pausa, 'en pausa no debe avanzar'
    page.click('button:has-text("Seguir")')
    page.click('.nav-item:has-text("Hoy")')
    page.wait_for_selector('#pomo-barra:not([hidden]) .pomo-barra-tiempo')
    foto(page, '16-hoy-con-barra')
    page.evaluate("AQ.app.temporizador.estado.finEn = Date.now() + 1000")
    page.wait_for_selector('text=¡Pomodoro completo!', timeout=5000)
    page.wait_for_timeout(300)
    assert int(page.inner_text('.pastilla-monedas').strip()) == saldo_antes + 3
    page.click('#pomo-barra button')
    page.wait_for_selector('text=Saltar el descanso')
    foto(page, '17-pomodoro-descanso')
    page.click('button:has-text("Saltar el descanso")')
    page.click('button:has-text("Otro pomodoro")')
    page.click('button:has-text("Terminar")')
    page.click('#dialogo [data-dialogo="si"]')
    page.wait_for_selector('button:has-text("Empezar")')
    assert page.locator('#pomo-barra').is_hidden()
    page.click('.nav-item:has-text("Hoy")')

    paso('configuración')
    page.click('[aria-label="Configuración"]')
    page.wait_for_selector('text=Tu cuenta')
    page.click('.segmentado .chip-radio:has-text("Grande")')
    assert page.evaluate("document.documentElement.dataset.letra") == 'grande'
    page.fill('#nombre-mascota', 'Pixel')
    page.click('form[data-form="nombre-mascota"] button')
    page.click('label[for="aj-sonido"]')
    assert page.evaluate("AQ.app.store.ajustes(AQ.app.perfilId).sonido") is False
    foto(page, '19-configuracion')
    page.click('.segmentado .chip-radio:has-text("Normal")')
    page.click('button:has-text("Salir de mi cuenta")')
    page.wait_for_selector('text=¿Quién va a estudiar hoy?')
    page.click('.tarjeta-perfil')
    page.wait_for_selector('text=Pixel')

    paso('panel del padre')
    page.click('[aria-label="Configuración"]')
    page.click('button:has-text("Panel del padre")')
    page.fill('#pin', '0000'); page.click('button:has-text("Entrar")')
    page.wait_for_selector('text=PIN incorrecto')
    page.fill('#pin', '1234'); page.click('button:has-text("Entrar")')
    page.wait_for_selector('text=Para aprobar')
    ctx2 = page.context
    page.set_viewport_size({'width': 1280, 'height': 900})
    foto(page, '10-padre')
    page.click('button:has-text("Validar ·")')
    page.wait_for_selector('text=Nada por revisar')
    page.click('button:has-text("Sí, hoy la revisamos")')
    page.wait_for_selector('text=Hoy ya la hicieron')

    paso('premios')
    page.click('button:has-text("Ajustes")')
    page.click('button:has-text("+ Premio")')
    page.fill('#nombre', 'Elegir la cena del viernes'); page.fill('#precio', '25')
    page.click('button:has-text("Agregar premio")')
    page.click('button:has-text("+ Premio")')
    page.fill('#nombre', 'Salida al cine'); page.fill('#precio', '600')
    page.click('button:has-text("Agregar premio")')
    foto(page, '11-ajustes')
    page.click('[data-accion="atras"]')

    paso('tarea cargada por el padre')
    page.click('button:has-text("+ Tarea")')
    page.fill('#titulo', 'Traer materiales para plástica')
    page.click('button:has-text("Agregar tarea")')
    page.wait_for_selector('text=la cargaste vos')
    page.click('button:has-text("Salir")')

    paso('canjear')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.click('.tarjeta-perfil')
    page.click('.nav-item:has-text("Mascota")')
    foto(page, '12-mascota')
    page.click('.fila-premio:has-text("Elegir la cena") button')
    foto(page, '12b-dialogo-canje')
    page.click('#dialogo [data-dialogo="si"]')
    page.wait_for_selector('text=Canjes por recibir')

    paso('devolver con nota')
    page.click('.nav-item:has-text("Hoy")')
    page.click('.fila-tarea:has-text("Cuestionario") .casillero')
    page.click('.fila-tarea:has-text("Leer el cuento") .casillero')

    paso('validar en el celular del chico')
    page.click('button:has-text("Validar con papá (2)")')
    page.fill('#dialogo-campo', '0000'); page.click('#dialogo [data-dialogo="si"]')
    page.wait_for_selector('#dialogo >> text=PIN incorrecto')
    page.fill('#dialogo-campo', '1234'); page.click('#dialogo [data-dialogo="si"]')
    page.wait_for_selector('text=Validación de papá')
    foto(page, '20-validar-celular')
    antes = page.evaluate("AQ.app.store.saldo(AQ.app.perfilId)")
    page.click('.item-aprobar:has-text("Leer el cuento") button:has-text("Validar ·")')
    page.wait_for_timeout(200)
    assert page.evaluate("AQ.app.store.saldo(AQ.app.perfilId)") == antes + 15
    page.click('button:has-text("Devolver con nota")')
    page.fill('.form-devolver input', 'Falta la pregunta 4')
    page.click('.form-devolver button[type=submit]')
    page.wait_for_selector('text=¡Todo revisado!')
    foto(page, '21-validado')
    page.click('button:has-text("Listo, devolver el celular")')
    page.wait_for_selector('text=Papá: Falta la pregunta 4')
    assert page.locator('button:has-text("Validar ·")').count() == 0
    page.evaluate("AQ.app.ir('validar')")
    assert page.evaluate("AQ.app.pantalla") == 'hoy', 'sin PIN no se puede volver a validar'

    page.click('[aria-label="Configuración"]')
    page.click('button:has-text("Panel del padre")')
    page.fill('#pin', '1234'); page.click('button:has-text("Entrar")')
    page.click('button:has-text("Entregado")')
    page.click('button:has-text("Salir")')
    page.click('.tarjeta-perfil')
    page.wait_for_selector('text=Papá: Falta la pregunta 4')
    foto(page, '13-hoy-devuelta')
    assert page.evaluate("AQ.app.store.mascota(AQ.app.perfilId).etapa") == 'huevo'

    paso('nacimiento con la tercera tarea validada')
    page.click('.fila-tarea:has-text("Cuestionario") .casillero')
    page.click('button:has-text("Validar con papá")')
    page.fill('#dialogo-campo', '1234'); page.click('#dialogo [data-dialogo="si"]')
    page.click('.item-aprobar:has-text("Cuestionario") button:has-text("Validar ·")')
    page.wait_for_selector('text=¡El huevo se abrió!')
    assert page.locator('#nacimiento .escena-nacimiento').count() == 0, 'no se muestra en la validación'
    page.click('button:has-text("Listo, devolver el celular")')
    page.wait_for_selector('#nacimiento .escena-nacimiento')
    page.wait_for_timeout(900);  page.screenshot(path=str(CAP / '22a-nacimiento-tiembla.png'))
    page.wait_for_timeout(1200); page.screenshot(path=str(CAP / '22b-nacimiento-rompe.png'))
    page.wait_for_timeout(1400); page.screenshot(path=str(CAP / '22c-nacimiento-final.png'))
    page.click('#nacimiento button:has-text("¡Hola")')
    assert page.locator('#nacimiento .escena-nacimiento').count() == 0
    page.reload(); page.click('.tarjeta-perfil')
    assert page.locator('#nacimiento .escena-nacimiento').count() == 0, 'la animación se ve una sola vez'
    page.click('button:has-text("Darle de comer")')
    page.wait_for_selector('text=Ya comió hoy')
    foto(page, '23-nacio-y-comio')
    page.click('[aria-label="Configuración"]')
    page.click('button:has-text("Salir de mi cuenta")')

    paso('persistencia tras recargar')
    page.reload()
    page.wait_for_selector('.tarjeta-perfil')
    saldo = page.inner_text('.tarjeta-perfil .monedas')
    print('   saldo tras recargar:', saldo)

    paso('pasan días sin comer')
    page.evaluate("AQ.Fecha.fijar(AQ.Fecha.sumarDias(AQ.Fecha.hoy(), 3))")
    page.click('.tarjeta-perfil')
    page.wait_for_selector('text=sin comer')
    vida = page.get_attribute('.tarjeta-mascota .vida', 'aria-label')
    print('   ', vida)
    assert vida == 'Vida: 3 de 5', vida
    foto(page, '18-mascota-debilitada')
    page.evaluate("AQ.Fecha.fijar(null)")
    page.click('[aria-label="Configuración"]')
    page.click('button:has-text("Salir de mi cuenta")')

    paso('exportar copia')
    page.click('text=Panel del padre')
    page.fill('#pin', '1234'); page.click('button:has-text("Entrar")')
    page.click('button:has-text("Ajustes")')
    with page.expect_download() as d:
        page.click('text=Descargar copia de seguridad')
    ruta = CAP / 'copia.json'
    d.value.save_as(str(ruta))
    assert ruta.stat().st_size > 200

    paso('copia como texto')
    page.click('text=Copiar copia como texto')
    page.wait_for_timeout(300)
    if page.locator('#dialogo .dialogo').count():
        page.click('#dialogo [data-dialogo="si"]')

    paso('borrar todo')
    page.click('text=Borrar todos los datos')
    page.click('#dialogo [data-dialogo="si"]')
    assert page.locator('#dialogo .dialogo').count() == 1, 'sin escribir BORRAR no debe borrar'
    page.fill('#dialogo-campo', 'borrar')
    page.click('#dialogo [data-dialogo="si"]')
    page.wait_for_selector('text=Crear PIN y seguir')

    nav.close()

if errores:
    print('ERRORES DE CONSOLA:')
    for e in errores: print('  ', e)
    sys.exit(1)
print('E2E OK')
