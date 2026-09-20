/* myCoolFont engine/trace — marching squares + unión de segmentos + RDP.
   Entrada: bitmap {w,h,data} 0/1. Salida: [{outer:[[x,y]...], holes:[...]}].
   Coordenadas en px, y hacia abajo. 100% código propio. */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  // Ramer-Douglas-Peucker
  function rdp(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let dmax = 0, idx = -1;
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
      for (let i = a + 1; i < b; i++) {
        const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
        if (d > dmax) { dmax = d; idx = i; }
      }
      if (dmax > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  function signedArea(loop) {
    let a = 0;
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i], q = loop[(i + 1) % loop.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  }

  // Marching squares sobre grilla binaria con borde de ceros. Segmentos [x1,y1,x2,y2].
  function marchSquares(data, w, h) {
    const W = w + 2, H = h + 2;
    const g = new Uint8Array(W * H);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[(y + 1) * W + (x + 1)] = data[y * w + x];
    const segs = [];
    const at = (x, y) => g[y * W + x];
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W - 1; x++) {
        const tl = at(x, y), tr = at(x + 1, y), br = at(x + 1, y + 1), bl = at(x, y + 1);
        const idx = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const T = [x + 0.5, y], R = [x + 1, y + 0.5], B = [x + 0.5, y + 1], L = [x, y + 0.5];
        const P = (p) => [p[0] - 1, p[1] - 1]; // quita el borde
        switch (idx) {
          case 1: case 14: segs.push([P(L), P(B)]); break;
          case 2: case 13: segs.push([P(B), P(R)]); break;
          case 3: case 12: segs.push([P(L), P(R)]); break;
          case 4: case 11: segs.push([P(T), P(R)]); break;
          case 6: case 9: segs.push([P(T), P(B)]); break;
          case 7: case 8: segs.push([P(L), P(T)]); break;
          case 5: segs.push([P(L), P(T)], [P(B), P(R)]); break;  // silla: resolución fija
          case 10: segs.push([P(T), P(R)], [P(L), P(B)]); break; // silla: resolución fija
        }
      }
    }
    return segs;
  }

  const key = (p) => p[0].toFixed(2) + ',' + p[1].toFixed(2);

  // Une segmentos en lazos cerrados (agnóstico a la orientación de cada segmento).
  function linkLoops(segs) {
    const adj = new Map();
    segs.forEach((s, i) => {
      for (const p of s) {
        const k = key(p);
        if (!adj.has(k)) adj.set(k, []);
        adj.get(k).push(i);
      }
    });
    const used = new Uint8Array(segs.length), loops = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const loop = [segs[i][0].slice(), segs[i][1].slice()];
      let guard = segs.length + 5;
      while (guard-- > 0) {
        const k = key(loop[loop.length - 1]);
        const cand = (adj.get(k) || []).find(j => !used[j]);
        if (cand == null) break;
        used[cand] = 1;
        const s = segs[cand];
        loop.push(key(s[0]) === k ? s[1].slice() : s[0].slice());
        if (key(loop[loop.length - 1]) === key(loop[0])) { loop.pop(); break; }
      }
      if (loop.length >= 3) loops.push(loop);
    }
    return loops;
  }

  function traceContours(bitmap, eps) {
    eps = eps == null ? 1.1 : eps;
    const loops = linkLoops(marchSquares(bitmap.data, bitmap.w, bitmap.h))
      .map(l => rdp(l, eps))
      .filter(l => l.length >= 3 && Math.abs(signedArea(l)) > 2);
    if (!loops.length) return [];
    // el lazo de mayor área = contorno externo; el resto = huecos
    loops.sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)));
    return [{ outer: loops[0], holes: loops.slice(1) }];
  }

  E.trace = { traceContours, signedArea, rdp };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
