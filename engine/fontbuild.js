/* myCoolFont engine/fontbuild — px (y abajo) -> em (y arriba) + ensamble.
   100% código propio. */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  function areaOf(loop) {
    let a = 0;
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  // glyphSpec: {code, traceLoops:[{outer,holes}], boxW, boxH}
  // Normaliza a em 1000: alto de caja -> 700 unidades sobre baseline.
  function toEmContours(spec) {
    const s = 700 / Math.max(1, spec.boxH);
    const out = [];
    for (const g of spec.traceLoops) {
      const conv = (loop) => loop.map(p => [p[0] * s, (spec.boxH - p[1]) * s - 200]);
      const outer = conv(g.outer);
      if (areaOf(outer) > 0) outer.reverse(); // externo = horario (área negativa en y-arriba)
      const holes = g.holes.map(h => {
        const c = conv(h);
        if (areaOf(c) < 0) c.reverse(); // hueco = antihorario
        return c;
      });
      out.push(outer, ...holes);
    }
    return out;
  }

  // specs: [{code, char, traceLoops, boxW, boxH}] -> Uint8Array TTF
  function buildFont(specs, family) {
    return buildFontWithVariants(specs.map(s => ({ ...s, variants: [s.traceLoops] })), family).ttf;
  }

  // specs: [{code, variants:[traceLoops,...] (base + reales), boxW, boxH,
  //          synth (n extra sintéticas), intensity, seed}]
  // Devuelve {ttf, altGroups}
  function buildFontWithVariants(specs, family) {
    const glyphs = [{ code: 0, contours: [], advance: 500 }]; // .notdef
    const altGroups = [];
    const hasSpace = specs.some(s => s.code === 32);
    for (const s of specs) {
      if (s.code === 32) { glyphs.push({ code: 32, contours: [], advance: 350 }); continue; }
      const base = toEmContours({ traceLoops: s.variants[0], boxW: s.boxW, boxH: s.boxH });
      const gidBase = glyphs.length;
      glyphs.push({ code: s.code, contours: base });
      const alts = [];
      for (const v of (s.variants.slice(1))) {
        alts.push(glyphs.length);
        glyphs.push({ code: 0, contours: toEmContours({ traceLoops: v, boxW: s.boxW, boxH: s.boxH }), advance: glyphs[gidBase].advance });
      }
      const nSynth = s.synth | 0;
      if (nSynth > 0) {
        const synths = E.variants.synthVariants(base, nSynth, s.intensity == null ? 0.5 : s.intensity, s.seed || s.code || 7);
        for (const syn of synths.slice(1)) {
          alts.push(glyphs.length);
          glyphs.push({ code: 0, contours: syn, advance: glyphs[gidBase].advance });
        }
      }
      if (alts.length) altGroups.push({ base: gidBase, alts });
    }
    if (!hasSpace) glyphs.push({ code: 0, contours: [], advance: 350 });
    const ttf = E.ttf.buildTTF(glyphs, { family: family || 'MyCoolFont', altGroups });
    return { ttf, altGroups };
  }

  E.fontbuild = { buildFont, buildFontWithVariants, toEmContours };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
