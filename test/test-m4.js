/* Test M4: variantes sintéticas + reales, GSUB/calt, WOFF.
   Corre: node test-m4.js */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const E = require('../engine/raster.js');
require('../engine/trace.js');
require('../engine/ttf.js');
require('../engine/variants.js');
require('../engine/fontbuild.js');
require('../engine/woff.js');

(async () => {
  let fails = 0;
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

  const tri = [[10, 60], [35, 60], [22, 10]];
  const tri2 = [[12, 62], [36, 58], [24, 12]]; // "real" dibujada distinta
  const { ttf, altGroups } = E.fontbuild.buildFontWithVariants([
    { code: 65, variants: [[{ outer: tri, holes: [] }]], boxW: 40, boxH: 70, synth: 2, intensity: 0.6, seed: 65 },
    { code: 66, variants: [[{ outer: tri, holes: [] }], [{ outer: tri2, holes: [] }]], boxW: 40, boxH: 70 },
  ], 'MCFVar');
  ok(altGroups.length === 2, `2 grupos con alternates (${altGroups.length})`);
  ok(altGroups[0].alts.length === 2, `A con 2 alternates sintéticas (${altGroups[0].alts.length})`);
  ok(altGroups[1].alts.length === 1, `B con 1 alternate real (${altGroups[1].alts.length})`);

  const out = path.join(__dirname, 'm4-test.ttf');
  fs.writeFileSync(out, ttf);
  const pyFile = path.join(__dirname, 'm4-validate.py');
  fs.writeFileSync(pyFile, `
from fontTools.ttLib import TTFont
f = TTFont(${JSON.stringify(out)});
assert 'GSUB' in f, 'falta GSUB'
gsub = f['GSUB'].table
feats = [r.FeatureTag for r in gsub.FeatureList.FeatureRecord]
print('features:', feats)
assert 'calt' in feats, 'falta calt'
print('lookups:', len(gsub.LookupList.Lookup))
for l in gsub.LookupList.Lookup: print('  lookup type', l.LookupType)
print('OK GSUB/calt');
`);
  const r = spawnSync('python', [pyFile], { encoding: 'utf8', shell: process.platform === 'win32' });
  console.log(r.stdout || '');
  if (r.status !== 0) { console.error('FAIL fontTools GSUB:\n' + (r.stderr || '')); fails++; }

  try {
    const woff = await E.woff.ttfToWoff(ttf);
    const sig = String.fromCharCode(...woff.slice(0, 4));
    ok(sig === 'wOFF', `WOFF firma wOFF (fue ${sig}, ${woff.length} bytes)`);
    fs.writeFileSync(path.join(__dirname, 'm4-test.woff'), woff);
  } catch (e) {
    console.log('SKIP WOFF (sin CompressionStream en este Node): ' + e.message);
  }

  for (const f of ['m4-test.ttf', 'm4-test.woff', 'm4-validate.py'])
    try { fs.unlinkSync(path.join(__dirname, f)); } catch {}
  console.log(fails ? `\n${fails} FALLOS` : '\nM4 OK');
  process.exit(fails ? 1 : 0);
})();
