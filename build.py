"""
build.py — Arma versiones de un solo archivo a partir del proyecto.

  python3 build.py

Genera:
  dist/al-dia.html          un solo archivo, se abre con doble clic o se sube a cualquier hosting
  dist/al-dia-artifact.html versión para publicar como página en Claude (sin <html>/<head>/<body>)
"""
import pathlib, re

RAIZ = pathlib.Path(__file__).resolve().parent
DIST = RAIZ / 'dist'
DIST.mkdir(exist_ok=True)

import base64
html = (RAIZ / 'index.html').read_text(encoding='utf-8')
css = (RAIZ / 'css' / 'styles.css').read_text(encoding='utf-8')
# La fuente va dentro del archivo, así funciona sin internet y sin archivos sueltos.
fuente = base64.b64encode((RAIZ / 'fonts' / 'lexend-latin.woff2').read_bytes()).decode('ascii')
css = css.replace("url('../fonts/lexend-latin.woff2')", "url(data:font/woff2;base64," + fuente + ")")
assert 'data:font/woff2' in css

html = html.replace('<link rel="stylesheet" href="css/styles.css">', '<style>\n' + css + '\n</style>')

def inline_script(m):
    codigo = (RAIZ / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in codigo, m.group(1)
    return '<script>\n/* ' + m.group(1) + ' */\n' + codigo + '\n</script>'

html = re.sub(r'<script src="(js/[^"]+)"></script>', inline_script, html)
(DIST / 'al-dia.html').write_text(html, encoding='utf-8')

# Versión artifact: solo el contenido de <head> (title, fuentes, estilos) y <body>.
cabeza = re.search(r'<head>(.*)</head>', html, re.S).group(1)
cabeza = re.sub(r'<meta[^>]*>\s*', '', cabeza)
cuerpo = re.search(r'<body>(.*)</body>', html, re.S).group(1)
(DIST / 'al-dia-artifact.html').write_text(cabeza.strip() + '\n' + cuerpo.strip() + '\n', encoding='utf-8')
print('listo:', [p.name for p in DIST.iterdir()])
