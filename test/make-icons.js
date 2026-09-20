/* Genera icons/icon-192.png e icon-512.png (M dibujada a bloques + punto verde).
   Solo usa zlib de Node (stdlib). Corre: node test/make-icons.js */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(px.slice(y * w * 4, (y + 1) * w * 4)).copy(raw, y * (w * 4 + 1) + 1);
  }
  const comp = zlib.deflateSync(raw);
  const chunk = (type, data) => {
    const h = Buffer.alloc(8); h.write(type, 0);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(require('zlib').crc32 ? 0 : 0, 0);
    // CRC32 manual (código propio, tabla generada)
    let table = chunk._t;
    if (!table) {
      table = chunk._t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
    }
    let c = 0xFFFFFFFF;
    const wb = Buffer.concat([h.slice(4), data]);
    for (const b of wb) c = table[(c ^ b) & 255] ^ (c >>> 8);
    crc.writeUInt32BE((c ^ 0xFFFFFFFF) >>> 0, 0);
    return Buffer.concat([len, h.slice(4), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}

// M a bloques sobre fondo #111 + punto verde
function drawM(size) {
  const px = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) { px[i * 4] = 17; px[i * 4 + 1] = 17; px[i * 4 + 2] = 17; px[i * 4 + 3] = 255; }
  const bar = (x0, y0, x1, y1, r, g, b) => {
    for (let y = Math.floor(y0 * size); y < Math.ceil(y1 * size); y++)
      for (let x = Math.floor(x0 * size); x < Math.ceil(x1 * size); x++) {
        const dx = x / size - 0.5, dy = y / size - 0.5;
        if (dx * dx + dy * dy > 0.24) continue; // recorte circular
        const i = (y * size + x) * 4;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
  };
  const W = 0.13;
  bar(0.20, 0.28, 0.20 + W, 0.74, 238, 238, 238);
  bar(0.67, 0.28, 0.67 + W, 0.74, 238, 238, 238);
  // diagonales de la M (bloques escalonados)
  for (let s = 0; s <= 6; s++) {
    const t = s / 6;
    bar(0.20 + W + t * 0.20, 0.28 + t * 0.22, 0.20 + W + t * 0.20 + 0.09, 0.28 + t * 0.22 + 0.10, 238, 238, 238);
    bar(0.67 - t * 0.20 - 0.02, 0.28 + t * 0.22, 0.67 - t * 0.20 + 0.07, 0.28 + t * 0.22 + 0.10, 238, 238, 238);
  }
  // punto verde firma
  const cx = 0.72 * size, cy = 0.76 * size, rr = 0.055 * size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 < rr * rr) { const i = (y * size + x) * 4; px[i] = 125; px[i + 1] = 216; px[i + 2] = 125; }
  }
  return px;
}

const dir = path.join(__dirname, '..', 'pwa', 'icons');
fs.mkdirSync(dir, { recursive: true });
for (const s of [192, 512]) {
  fs.writeFileSync(path.join(dir, `icon-${s}.png`), png(s, s, drawM(s)));
  console.log(`OK icon-${s}.png`);
}
