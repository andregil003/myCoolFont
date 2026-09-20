/* myCoolFont engine/raster — mapa de bits: grises, umbral, componentes, recortes.
   100% código propio. Funciona en navegador y en Node (para tests). */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  // ImageData (RGBA) -> luminancia 0..255
  function grayscale(img) {
    const d = img.data, n = img.width * img.height, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    return out;
  }

  // Otsu: umbral automático tinta/fondo. Devuelve binario (1=tinta).
  function thresholdOtsu(luma) {
    const hist = new Uint32Array(256);
    for (let i = 0; i < luma.length; i++) hist[luma[i] | 0]++;
    const total = luma.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, best = 0, thresh = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (!wB) continue;
      const wF = total - wB;
      if (!wF) break;
      sumB += t * hist[t];
      const mB = sumB / wB, mF = (sum - sumB) / wF;
      const between = wB * wF * (mB - mF) * (mB - mF);
      if (between > best) { best = between; thresh = t; }
    }
    // tinta = lo OSCURO (menor que umbral); si la página es más tinta que fondo, invertir
    const bin = new Uint8Array(total);
    let dark = 0;
    for (let i = 0; i < total; i++) { const ink = luma[i] <= thresh ? 1 : 0; bin[i] = ink; dark += ink; }
    if (dark > total / 2) for (let i = 0; i < total; i++) bin[i] = bin[i] ? 0 : 1;
    return { binary: bin, thresh };
  }

  // Componentes conexos (flood fill, 4-vecinos). Orden de lectura: por filas, izq->der.
  function components(binary, w, h, minArea) {
    minArea = minArea || 12;
    const seen = new Uint8Array(w * h), boxes = [];
    const stack = [];
    for (let s = 0; s < w * h; s++) {
      if (!binary[s] || seen[s]) continue;
      let x0 = w, y0 = h, x1 = -1, y1 = -1, area = 0;
      stack.push(s); seen[s] = 1;
      while (stack.length) {
        const p = stack.pop(), x = p % w, y = (p / w) | 0;
        area++;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x > 0 && binary[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (x < w - 1 && binary[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && binary[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
        if (y < h - 1 && binary[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
      }
      if (area >= minArea) boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, area });
    }
    // orden de lectura: agrupa por bandas horizontales solapadas
    boxes.sort((a, b) => (a.y - b.y) || (a.x - b.x));
    const rows = [];
    for (const b of boxes) {
      let row = rows.find(r => b.y < r.y1 && r.y0 < b.y + b.h);
      if (!row) { row = { y0: b.y, y1: b.y + b.h, items: [] }; rows.push(row); }
      else { if (b.y < row.y0) row.y0 = b.y; if (b.y + b.h > row.y1) row.y1 = b.y + b.h; }
      row.items.push(b);
    }
    const out = [];
    for (const r of rows) { r.items.sort((a, b) => a.x - b.x); out.push(...r.items); }
    return out;
  }

  // Recorta un componente con margen. Devuelve {w,h,data(Uint8 0/1)}.
  function crop(binary, w, h, box, pad) {
    pad = pad == null ? 2 : pad;
    const x0 = Math.max(0, box.x - pad), y0 = Math.max(0, box.y - pad);
    const x1 = Math.min(w, box.x + box.w + pad), y1 = Math.min(h, box.y + box.h + pad);
    const cw = x1 - x0, ch = y1 - y0, data = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) data[y * cw + x] = binary[(y0 + y) * w + (x0 + x)];
    return { w: cw, h: ch, data };
  }

  E.raster = { grayscale, thresholdOtsu, components, crop };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
