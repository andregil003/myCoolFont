/* myCoolFont engine/variants — variantes SINTÉTICAS propias sobre contornos.
   Transformaciones afines + ruido por punto, con semilla (reproducible).
   Las variantes REALES son simplemente más celdas dibujadas (mismo formato).
   100% código propio. */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  // PRNG mulberry32
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function bboxOf(loops) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const l of loops) for (const p of l) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  // loops (coords em) -> loops variados. intensity 0..1.
  function vary(loops, intensity, seed) {
    const r = rng(seed);
    const bb = bboxOf(loops);
    const w = Math.max(1, bb.x1 - bb.x0), h = Math.max(1, bb.y1 - bb.y0);
    const ang = (r() - 0.5) * 0.06 * intensity;       // ±1.7°
    const sx = 1 + (r() - 0.5) * 0.10 * intensity;    // ancho ±5%
    const sy = 1 + (r() - 0.5) * 0.08 * intensity;    // alto ±4%
    const sh = (r() - 0.5) * 0.06 * intensity;        // shear
    const dx = (r() - 0.5) * 0.03 * w * intensity;
    const dy = (r() - 0.5) * 0.03 * h * intensity;
    const jx = 0.012 * w * intensity, jy = 0.012 * h * intensity;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    return loops.map(loop => loop.map(p => {
      let x = (p[0] - bb.cx) * sx, y = (p[1] - bb.cy) * sy;
      const rx = x * ca - y * sa + x * sh * 0 + x, ry = x * sa + y * ca;
      x = rx + sh * y;
      x += bb.cx + dx + (r() - 0.5) * 2 * jx;
      y = ry + bb.cy + dy + (r() - 0.5) * 2 * jy;
      return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
    }));
  }

  // traceLoops (px) ya en em? No: opera sobre contornos EM (salida de toEmContours).
  // Devuelve [base, alt1, alt2...] (n total = 1 + extra).
  function synthVariants(emLoops, extra, intensity, seed) {
    const out = [emLoops];
    for (let i = 0; i < extra; i++) out.push(vary(emLoops, intensity, (seed || 1) * 1000 + i * 77));
    return out;
  }

  E.variants = { vary, synthVariants, rng };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
