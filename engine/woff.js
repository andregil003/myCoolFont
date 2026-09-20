/* myCoolFont engine/woff — TTF -> WOFF v1 (deflate vía CompressionStream nativa).
   Sin librerías: el navegador/Node comprime, nosotros ensamblamos. 100% propio. */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  async function deflateRaw(u8) {
    if (typeof CompressionStream === 'undefined') throw new Error('sin CompressionStream');
    const out = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(out).arrayBuffer());
  }

  function be(dv, off, len) {
    const b = [];
    for (let i = 0; i < len; i++) b.push(dv.getUint8(off + i));
    return b;
  }

  async function ttfToWoff(ttf) {
    const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
    const numTables = dv.getUint16(4);
    const entries = [];
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      entries.push({
        tag: be(dv, o, 4), checkSum: dv.getUint32(o + 4),
        offset: dv.getUint32(o + 8), length: dv.getUint32(o + 12),
      });
    }
    const blobs = [];
    for (const e of entries) blobs.push(await deflateRaw(ttf.slice(e.offset, e.offset + e.length)));
    const dirLen = 44 + 20 * numTables;
    let totalSfnt = 12 + 16 * numTables;
    for (const e of entries) totalSfnt += (e.length + 3) & ~3;
    const out = [];
    const u16 = v => out.push((v >>> 8) & 255, v & 255);
    const u32 = v => out.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255);
    u32(0x774F4646); u32(0x00010000);
    let woffLen = dirLen;
    for (const b of blobs) woffLen += (b.length + 3) & ~3;
    u32(woffLen); u16(numTables); u16(0); u32(totalSfnt);
    u16(1); u16(0); u32(0); u32(0); u32(0); u32(0); u32(0);
    let off = dirLen;
    entries.forEach((e, i) => {
      out.push(...e.tag); u32(off); u32(blobs[i].length); u32(e.length); u32(e.checkSum);
      off += (blobs[i].length + 3) & ~3;
    });
    blobs.forEach(b => { out.push(...b); while (out.length % 4) out.push(0); });
    return new Uint8Array(out);
  }

  E.woff = { ttfToWoff };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
