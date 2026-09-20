# Changelog — myCoolFont

Formato [Keep a Changelog](https://keepachangelog.com/). Versiones [SemVer](https://semver.org/).

## [1.0.0] - 2026-09-20

Primera versión pública. Por Jorge André Gil Leonardo.

### Añadido
- PWA instalable y offline: plantilla, dibujo con stylus (3 variantes por letra), foto de papel, letras, vista previa con FontFace, descarga TTF + WOFF.
- Motor 100% propio sin dependencias: Otsu, componentes, marching-squares + RDP, constructor TTF (head/hhea/maxp/OS-2/name/cmap/hmtx/loca/glyf/post + GSUB/calt), WOFF v1.
- Charset mate: español completo + símbolos de matemáticas (`× ÷ = ≠ √ ≤ ≥ ° ±`).
- CLI Node: plantilla, make, variantes, preview, render, instalar (Windows sin admin), doctor.
- Tests M2/M3/M4 (validados con fontTools) + test de vistas en Chromium (12/12).
- Deploy automático a GitHub Pages.
