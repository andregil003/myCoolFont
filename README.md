# myCoolFont ✍️

**Tu letra hecha fuente.** Convierte tu manuscrito en una fuente `.ttf` instalable con variantes que rotan solas, para que nadie note que es una fuente.

🌐 **Pruébala aquí:** https://andregil003.github.io/myCoolFont/

Hecho por **Jorge André Gil Leonardo** — 100% gratis, 100% local. Nada se sube a ningún servidor: todo pasa en tu dispositivo.

## Qué hace

- **Apuntes y tareas** con tu letra (español completo: `Ññ ÁÉÍÓÚ Ü ¿? ¡!`)
- **Worksheets de mate**: charset mate con `0-9 + − × ÷ = ≠ % ( ) [ ] √ ≤ ≥ °`
- **Dibuja directo** con tu stylus en la app, o sube foto de tu papel
- **2-3 versiones por letra** (reales dibujadas + sintéticas) con rotación `calt`
- **Títulos y portadas** como SVG/PNG con variación natural
- **Web**: salida `.woff` para tus páginas

## Uso (2 min, sin instalar nada)

1. Abre https://andregil003.github.io/myCoolFont/ en Chrome (PC o tablet)
2. **Dibujar**: raya cada letra con tu stylus (3 celdas = 3 variantes reales)
3. **Vista previa**: mira tu texto con tu fuente
4. **Descargar**: baja tu `.ttf` e instálalo con doble clic

O instálala como app: Chrome → ⋮ → "Instalar myCoolFont". Funciona offline.

## También hay CLI (Node 18+)

```bash
node bin/mycoolfont.js plantilla -o plantilla.pdf --charset mate
node bin/mycoolfont.js make foto.jpg --charset mate --name "MateAndre"
node bin/mycoolfont.js variantes MateAndre.ttf --alternates 3
node bin/mycoolfont.js instalar MateAndre-jittered.ttf
```

## Cómo funciona

```
tu mano -> dibujo/foto -> detector propio -> vectorizador propio
       -> constructor TTF propio (10 tablas + calt) -> .ttf/.woff
```

Motor escrito desde cero en este repo (`engine/`): threshold Otsu, componentes conexos, marching-squares, RDP, ensamble TrueType con checksums reales y `calt` para rotación de variantes. Sin dependencias.

## Tests

```bash
node test/test-m2.js   # raster + trazo
node test/test-m3.js   # TTF validado con fontTools
node test/test-m4.js   # variantes + GSUB + WOFF
python test/test-views.py  # PWA en Chromium (12 checks, requiere playwright)
```

## Licencia

MIT © 2026 Jorge André Gil Leonardo. Ver `LICENSE`.
