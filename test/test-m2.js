/* Test M2: raster + trace sobre bitmaps sintéticos. Corre con: node test-m2.js */
'use strict';
const E = require('../engine/raster.js');
require('../engine/trace.js');
const { raster, trace } = E;
let fails = 0;
function ok(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) fails++; }

// Bitmap 40x40: anillo (rect lleno menos hueco) + punto separado
const W = 40, H = 40, data = new Uint8Array(W * H);
for (let y = 5; y < 25; y++) for (let x = 5; x < 25; x++) data[y * W + x] = 1;
for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) data[y * W + x] = 0;
data[35 * W + 35] = 1; data[35 * W + 36] = 1; data[36 * W + 35] = 1; data[36 * W + 36] = 1;
data[35 * W + 37] = 1; data[36 * W + 37] = 1; data[37 * W + 35] = 1; data[37 * W + 36] = 1; data[37 * W + 37] = 1;

const comps = raster.components(data, W, H, 4);
ok(comps.length === 2, `componentes detectados = 2 (fue ${comps.length})`);
ok(comps[0].w === 20 && comps[0].h === 20, `bbox anillo 20x20 (fue ${comps[0].w}x${comps[0].h})`);

const ring = raster.crop(data, W, H, comps[0], 1);
const glyphs = trace.traceContours(ring);
ok(glyphs.length === 1, 'un glifo trazado');
ok(glyphs[0].holes.length === 1, `un hueco detectado (fue ${glyphs[0].holes.length})`);
ok(glyphs[0].outer.length >= 4 && glyphs[0].outer.length < 60, `outer simplificado razonable (${glyphs[0].outer.length} pts)`);

// Otsu sobre imagen sintética: mitad oscura / mitad clara
const luma = new Float32Array(200);
for (let i = 0; i < 100; i++) luma[i] = 30;
for (let i = 100; i < 200; i++) luma[i] = 220;
const t = raster.thresholdOtsu(luma);
let ink = 0; for (const v of t.binary) ink += v;
ok(ink === 100, `otsu separa tinta/fondo (tinta=${ink})`);

console.log(fails ? `\n${fails} FALLOS` : '\nM2 OK');
process.exit(fails ? 1 : 0);
