/* Test M3: construye TTF real (A triángulo + O anillo trazado) y lo valida con fontTools.
   Corre: node test-m3.js  (requiere: pip install fonttools) */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../engine/raster.js');
require('../engine/trace.js');
require('../engine/ttf.js');
require('../engine/fontbuild.js');
const { spawnSync } = require('child_process');

const tri = [[10, 60], [35, 60], [22, 10]]; // A simplificada (px, y abajo)
const W = 40, H = 40, data = new Uint8Array(W * H);
for (let y = 5; y < 30; y++) for (let x = 5; x < 30; x++) data[y * W + x] = 1;
for (let y = 13; y < 23; y++) for (let x = 13; x < 23; x++) data[y * W + x] = 0;
const comps = E.raster.components(data, W, H, 4);
const ring = E.raster.crop(data, W, H, comps[0], 1);
const loops = E.trace.traceContours(ring);

const ttf = E.fontbuild.buildFont([
  { code: 65, traceLoops: [{ outer: tri, holes: [] }], boxW: 40, boxH: 70 },
  { code: 79, traceLoops: loops, boxW: ring.w, boxH: ring.h },
  { code: 32, traceLoops: [], boxW: 1, boxH: 1 },
], 'MCFTest');
const out = path.join(__dirname, 'm3-test.ttf');
fs.writeFileSync(out, ttf);
console.log(`TTF escrito: ${ttf.length} bytes`);

const pyFile = path.join(__dirname, 'm3-validate.py');
fs.writeFileSync(pyFile, `
from fontTools.ttLib import TTFont
f = TTFont(${JSON.stringify(out)});
print('glyphs:', f.getGlyphOrder());
print('cmap A/O/space:', {k: v for k, v in f.getBestCmap().items() if k in (65, 79, 32)});
assert f['name'].getDebugName(1) == 'MCFTest', 'nombre familia mal: %r' % f['name'].getDebugName(1)
assert f['name'].getDebugName(6) == 'MCFTest-Regular', 'postscript name mal'
g = f['glyf']['A']; print('A contours:', g.numberOfContours); g.expand(f); print('A pts:', len(g.coordinates));
assert list(g.coordinates) == [(220,400),(350,-100),(100,-100)], 'coords A mal: %r' % list(g.coordinates)
o = f['glyf']['O']; print('O contours:', o.numberOfContours); o.expand(f); print('O pts:', len(o.coordinates));
print('OK fontTools abre el TTF');
`);
const r = spawnSync('python', [pyFile], { encoding: 'utf8', shell: process.platform === 'win32' });
console.log(r.stdout || '');
if (r.status !== 0 || /Error|Traceback/.test(r.stdout + r.stderr)) {
  console.error('FAIL validación fontTools:\n' + (r.stderr || r.stdout));
  process.exit(1);
}
console.log('M3 OK');
