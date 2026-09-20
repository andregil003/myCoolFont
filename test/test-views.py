"""Test de vistas myCoolFont PWA con Chromium headless.
Dibuja trazos reales, construye la fuente y descarga el TTF.
Corre: python test/test-views.py"""
import subprocess, time, sys, os
from playwright.sync_api import sync_playwright

PWA = os.path.join(os.path.dirname(__file__), '..', 'pwa')
SHOTS = r'C:\Users\andre\AppData\Local\Temp\opencode'
os.makedirs(SHOTS, exist_ok=True)
fails = []
def check(cond, msg):
    print(('PASS ' if cond else 'FAIL ') + msg)
    if not cond: fails.append(msg)

srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8901', '--directory', PWA],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1100, 'height': 800})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        pg.goto('http://localhost:8901/index.html')
        pg.wait_for_timeout(800)
        check(pg.locator('main#view h2').count() > 0, 'plantilla se mira (h2 presente)')
        check('MCF' in (pg.evaluate('() => Object.keys(window.MCFE || {})').__str__() or '') or pg.evaluate('() => !!window.MCFE && !!MCFE.trace'), 'motor MCFE cargado')

        # PLANTILLA: generar cuadrícula
        pg.click('#genGrid')
        pg.wait_for_timeout(400)
        check(pg.locator('#pg canvas').count() == 1, 'plantilla genera cuadrícula visible')
        pg.screenshot(path=os.path.join(SHOTS, 'mcf-plantilla.png'))

        # DIBUJAR: trazo real en v1 de la "A"
        pg.click('button[data-view="dibujar"]')
        pg.wait_for_timeout(300)
        pg.select_option('#ch', 'A')
        pg.wait_for_timeout(300)
        box = pg.locator('#cells canvas').first.bounding_box()
        check(box is not None, 'dibujar muestra 3 celdas')
        # dibuja una "A" con el mouse: dos diagonales + travesaño
        x0, y0, w, h = box['x'], box['y'], box['width'], box['height']
        pg.mouse.move(x0 + w * 0.3, y0 + h * 0.85)
        pg.mouse.down()
        for i in range(1, 11): pg.mouse.move(x0 + w * (0.3 + 0.2 * i / 10), y0 + h * (0.85 - 0.7 * i / 10), steps=2)
        pg.mouse.up()
        pg.mouse.move(x0 + w * 0.7, y0 + h * 0.85)
        pg.mouse.down()
        for i in range(1, 11): pg.mouse.move(x0 + w * (0.7 - 0.2 * i / 10), y0 + h * (0.85 - 0.7 * i / 10), steps=2)
        pg.mouse.up()
        pg.mouse.move(x0 + w * 0.38, y0 + h * 0.55)
        pg.mouse.down(); pg.mouse.move(x0 + w * 0.62, y0 + h * 0.55, steps=5); pg.mouse.up()
        pg.click('#save')
        pg.wait_for_timeout(400)
        msg = pg.locator('#msg').inner_text()
        check('Guardada' in msg, f'dibujar guarda variante ({msg})')
        n = pg.evaluate('() => (MCF.glyphs["A"] || []).length')
        check(n == 1, f'A tiene 1 variante guardada (hay {n})')
        pg.screenshot(path=os.path.join(SHOTS, 'mcf-dibujar.png'))

        # dibuja también "7" para que la previa tenga 2 glifos
        pg.select_option('#ch', '7')
        pg.wait_for_timeout(300)
        box = pg.locator('#cells canvas').first.bounding_box()
        x0, y0, w, h = box['x'], box['y'], box['width'], box['height']
        pg.mouse.move(x0 + w * 0.3, y0 + h * 0.2); pg.mouse.down()
        pg.mouse.move(x0 + w * 0.7, y0 + h * 0.2, steps=5)
        pg.mouse.move(x0 + w * 0.4, y0 + h * 0.85, steps=8); pg.mouse.up()
        pg.click('#save')
        pg.wait_for_timeout(400)

        # LETRAS
        pg.click('button[data-view="letras"]')
        pg.wait_for_timeout(300)
        txt = pg.locator('#g').inner_text()
        check('A ×1' in txt and '7 ×1' in txt, f'letras muestra A y 7 ({txt[:60]})')
        check(pg.locator('#g canvas').count() >= 2, 'letras dibuja miniaturas')
        pg.screenshot(path=os.path.join(SHOTS, 'mcf-letras.png'))

        # FOTO (solo que se mire + input existe)
        pg.click('button[data-view="foto"]')
        pg.wait_for_timeout(300)
        check(pg.locator('#fi').count() == 1, 'foto muestra input de archivo')
        pg.screenshot(path=os.path.join(SHOTS, 'mcf-foto.png'))

        # PREVIA: construir y renderizar con la fuente propia
        pg.click('button[data-view="previa"]')
        pg.wait_for_timeout(300)
        pg.fill('#txt', 'A7A')
        pg.click('#build')
        pg.wait_for_timeout(1500)
        out = pg.locator('#out').inner_text()
        fam = pg.evaluate('() => getComputedStyle(document.querySelector("#out")).fontFamily')
        check(out == 'A7A' and 'MCFPrev' in fam, f'previa renderiza con tu fuente (fam={fam})')
        pg.screenshot(path=os.path.join(SHOTS, 'mcf-previa.png'))

        # DESCARGAR: TTF real con bytes
        pg.click('button[data-view="descargar"]')
        pg.wait_for_timeout(300)
        with pg.expect_download() as dl:
            pg.click('#dT')
        path = dl.value.path()
        size = os.path.getsize(path)
        check(size > 500, f'descarga TTF con {size} bytes')
        dl.value.save_as(os.path.join(SHOTS, 'mcf-prueba.ttf'))
        pg.screenshot(path=os.path.join(SHOTS, 'mcf-descargar.png'))

        check(len(errors) == 0, f'cero errores JS en consola ({len(errors)})')
        for e in errors[:5]: print('  JS:', e[:160])
        b.close()
finally:
    srv.terminate()

print('\nVISTAS OK' if not fails else f'\n{len(fails)} FALLOS')
sys.exit(1 if fails else 0)
