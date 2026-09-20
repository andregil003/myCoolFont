/* myCoolFont engine/ttf — constructor TrueType desde cero (contornos -> .ttf).
   Tablas: head hhea maxp OS/2 name cmap hmtx loca glyf post (+GSUB en M4).
   Solo segmentos de línea (puntos on-curve). UPM 1000. 100% código propio. */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  function W() { this.b = []; }
  W.prototype.u8 = function (v) { this.b.push(v & 255); };
  W.prototype.u16 = function (v) { this.b.push((v >>> 8) & 255, v & 255); };
  W.prototype.i16 = function (v) { this.u16(v < 0 ? 0x10000 + v : v); };
  W.prototype.u32 = function (v) { this.b.push((v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255); };
  W.prototype.fixed = function (v) { this.u32(Math.round(v * 65536) >>> 0); };
  W.prototype.str = function (s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); };
  W.prototype.bytes = function (arr) { for (const x of arr) this.u8(x); };
  W.prototype.len = function () { return this.b.length; };
  W.prototype.pad4 = function () { while (this.b.length % 4) this.b.push(0); };

  function checksum(bytes) {
    let s = 0;
    for (let i = 0; i < bytes.length; i += 4) {
      s = (s + ((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3])) >>> 0;
    }
    return s >>> 0;
  }

  // glyf de un glifo: contours = array de lazos [[x,y]...] (coords fuente, y arriba).
  // Devuelve {data, xMin,yMin,xMax,yMax, nPoints, nContours}.
  function buildGlyph(contours) {
    const w = new W();
    let xMin = 0, yMin = 0, xMax = 0, yMax = 0, nPoints = 0;
    if (!contours.length) { w.i16(0); w.i16(0); w.i16(0); w.i16(0); w.i16(0); return { data: w.b, xMin, yMin, xMax, yMax, nPoints, nContours: 0 }; }
    for (const loop of contours) for (const p of loop) {
      nPoints++;
      if (p[0] < xMin) xMin = Math.floor(p[0]); if (p[0] > xMax) xMax = Math.ceil(p[0]);
      if (p[1] < yMin) yMin = Math.floor(p[1]); if (p[1] > yMax) yMax = Math.ceil(p[1]);
    }
    w.i16(contours.length);
    w.i16(xMin); w.i16(yMin); w.i16(xMax); w.i16(yMax);
    let acc = 0;
    for (const loop of contours) { acc += loop.length; w.u16(acc - 1); }
    w.u16(0); // instructionLength
    // flags + coordenadas con compresión de repetición y deltas cortos
    const flags = [], xs = [], ys = [];
    let px = 0, py = 0;
    for (const loop of contours) for (const p of loop) {
      const x = Math.round(p[0]), y = Math.round(p[1]);
      let dx = x - px, dy = y - py, f = 0x01; // on-curve siempre
      if (dx === 0) f |= 0x10;
      else if (dx > -256 && dx < 256) { f |= 0x02; if (dx > 0) f |= 0x10; }
      if (dy === 0) f |= 0x20;
      else if (dy > -256 && dy < 256) { f |= 0x04; if (dy > 0) f |= 0x20; }
      flags.push({ f, dx, dy }); px = x; py = y;
    }
    // repeticiones
    const out = [];
    for (let i = 0; i < flags.length;) {
      let j = i;
      while (j + 1 < flags.length && (flags[j + 1].f & ~0x08) === (flags[i].f & ~0x08) && j + 1 - i < 255) j++;
      let f = flags[i].f;
      if (j > i) { f |= 0x08; out.push(f, j - i); }
      else out.push(f);
      i = j + 1;
    }
    w.bytes(out);
    for (const g of flags) {
      if (g.f & 0x02) w.u8(Math.abs(g.dx)); // short: magnitud (el signo va en el flag)
      else if (!(g.f & 0x10)) w.i16(g.dx);
    }
    for (const g of flags) {
      if (g.f & 0x04) w.u8(Math.abs(g.dy));
      else if (!(g.f & 0x20)) w.i16(g.dy);
    }
    return { data: w.b, xMin, yMin, xMax, yMax, nPoints, nContours: contours.length };
  }

  // cmap format 4 desde pares ordenados [codepoint, gid]
  function buildCmap(pairs) {
    const runs = [];
    for (const [c, g] of pairs) {
      const last = runs[runs.length - 1];
      if (last && c === last.end + 1 && g === last.gid + 1) { last.end = c; last.gid = g; }
      else runs.push({ start: c, end: c, gid: g });
    }
    const segs = runs.map(r => ({ start: r.start, end: r.end, delta: r.gid - r.start }));
    segs.push({ start: 0xFFFF, end: 0xFFFF, delta: 1 }); // 0xFFFF -> .notdef (OTS exige gid en rango)
    const segCount = segs.length;
    const w = new W();
    w.u16(4); w.u16(16 + 8 * segCount); // format 4, length (exacta)
    w.u16(0); // language
    w.u16(segCount * 2);
    const pow2 = 1 << Math.floor(Math.log2(segCount));
    w.u16(pow2 * 2); w.u16(Math.log2(pow2)); w.u16(segCount * 2 - pow2 * 2);
    for (const s of segs) w.u16(s.end);
    w.u16(0); // reservedPad
    for (const s of segs) w.u16(s.start);
    for (const s of segs) w.i16(((s.delta % 65536) + 65536) % 65536 > 32767 ? ((s.delta % 65536) + 65536) % 65536 - 65536 : s.delta);
    for (const _ of segs) w.u16(0); // idRangeOffset = 0
    return w.b;
  }

  function buildName(family) {
    const strs = [[1, family], [2, 'Regular'], [4, family + ' Regular'], [6, family.replace(/\s+/g, '') + '-Regular']];
    const w = new W();
    w.u16(0); w.u16(strs.length); w.u16(6 + 12 * strs.length); // format, count, stringOffset
    let offset = 0; // offsets relativos al inicio del almacén de strings
    const blobs = strs.map(([id, s]) => {
      const b = [];
      for (const ch of s) { const c = ch.codePointAt(0); b.push((c >>> 8) & 255, c & 255); }
      return { id, b };
    });
    for (const { id, b } of blobs) { w.u16(3); w.u16(1); w.u16(0x409); w.u16(id); w.u16(b.length); w.u16(offset); offset += b.length; }
    for (const { b } of blobs) w.bytes(b);
    return w.b;
  }

  // ---- GSUB con calt (rotación de variantes) ----
  // altGroups: [{base: gid, alts: [gidA1, gidA2?]}]
  // Nivel 0: base precedida de base -> alt1. Nivel 1: alt1 precedida de alt1 -> alt2.
  function buildCoverage(gids) {
    const s = [...new Set(gids)].sort((a, b) => a - b);
    const w = new W(); w.u16(1); w.u16(s.length);
    for (const g of s) w.u16(g);
    return w.b;
  }
  function buildSingleSubst(fromGids, toGids) {
    const w = new W(); w.u16(2); w.u16(6 + 2 * fromGids.length); w.u16(fromGids.length);
    for (const t of toGids) w.u16(t);
    return w.b.concat(buildCoverage(fromGids));
  }
  function buildChain(backCov, inCov, lookupIndex) {
    const headLen = 18;
    const w = new W();
    w.u16(3); w.u16(1); w.u16(headLen); w.u16(1); w.u16(headLen + backCov.length);
    w.u16(0); w.u16(1); w.u16(0); w.u16(lookupIndex);
    return w.b.concat(backCov, inCov);
  }
  function buildLookup(type, sub) {
    const w = new W(); w.u16(type); w.u16(0); w.u16(1); w.u16(8);
    return w.b.concat(sub);
  }
  function buildGSUB(altGroups) {
    const withA2 = altGroups.filter(g => g.alts.length > 1);
    const baseGids = altGroups.map(g => g.base);
    const a1Gids = altGroups.map(g => g.alts[0]);
    const lookups = [];
    lookups.push(buildLookup(6, buildChain(buildCoverage(baseGids), buildCoverage(baseGids), 1)));
    lookups.push(buildLookup(1, buildSingleSubst(baseGids, a1Gids)));
    const featIdx = [0];
    if (withA2.length) {
      const b2 = withA2.map(g => g.alts[0]), t2 = withA2.map(g => g.alts[1]);
      lookups.push(buildLookup(6, buildChain(buildCoverage(b2), buildCoverage(b2), 3)));
      lookups.push(buildLookup(1, buildSingleSubst(b2, t2)));
      featIdx.push(2);
    }
    // LookupList
    const ll = new W(); ll.u16(lookups.length);
    let off = 2 + 2 * lookups.length;
    for (const l of lookups) { ll.u16(off); off += l.length; }
    for (const l of lookups) ll.bytes(l);
    // FeatureList (calt)
    const f = new W(); f.u16(0); f.u16(featIdx.length);
    for (const i of featIdx) f.u16(i);
    const fl = new W(); fl.u16(1); fl.str('calt'); fl.u16(8); fl.bytes(f.b);
    // ScriptList (DFLT)
    const lang = new W(); lang.u16(0); lang.u16(0xFFFF); lang.u16(1); lang.u16(0);
    const sc = new W(); sc.u16(4); sc.u16(0); sc.bytes(lang.b);
    const sl = new W(); sl.u16(1); sl.str('DFLT'); sl.u16(8); sl.bytes(sc.b);
    // Header
    const h = new W(); h.u16(1); h.u16(0); h.u16(10);
    h.u16(10 + sl.b.length); h.u16(10 + sl.b.length + fl.b.length);
    return h.b.concat(sl.b, fl.b, ll.b);
  }

  // glyphs: [{code (0=sin unicode: .notdef/space), contours, advance}]
  // opts: {family, upm, ascent, descent}
  function buildTTF(glyphs, opts) {
    opts = opts || {};
    const family = opts.family || 'MyCoolFont';
    const upm = 1000, ascent = opts.ascent || 800, descent = opts.descent || -200;
    // glyf + loca + métricas
    const loca = [0];
    const glyfW = new W();
    let maxPoints = 0, maxContours = 0;
    let gx0 = 0, gy0 = 0, gx1 = 0, gy1 = 0, hasBounds = false;
    const hmetrics = [];
    for (const g of glyphs) {
      const r = buildGlyph(g.contours);
      if (r.nPoints > maxPoints) maxPoints = r.nPoints;
      if (r.nContours > maxContours) maxContours = r.nContours;
      if (r.nContours) {
        if (!hasBounds) { gx0 = r.xMin; gy0 = r.yMin; gx1 = r.xMax; gy1 = r.yMax; hasBounds = true; }
        else {
          if (r.xMin < gx0) gx0 = r.xMin; if (r.yMin < gy0) gy0 = r.yMin;
          if (r.xMax > gx1) gx1 = r.xMax; if (r.yMax > gy1) gy1 = r.yMax;
        }
      }
      const adv = g.advance != null ? g.advance : (r.nContours ? (r.xMax - r.xMin + 160) : 400);
      hmetrics.push({ adv, lsb: r.nContours ? r.xMin : 0 });
      glyfW.bytes(r.data);
      if (glyfW.len() % 2) glyfW.u8(0); // loca-short exige offsets pares
      loca.push(glyfW.len());
    }
    const glyf = glyfW.b.slice();
    const locaShort = loca.map(o => o / 2);
    // head
    const head = new W();
    head.fixed(1.0); head.fixed(1.0); head.u32(0); head.u32(0x5F0F3CF5);
    head.u16(0); head.u16(upm);
    const now = Math.floor(Date.now() / 1000) + 2082844800;
    head.u32(Math.floor(now / 4294967296)); head.u32(now >>> 0);
    head.u32(Math.floor(now / 4294967296)); head.u32(now >>> 0);
    head.i16(gx0); head.i16(gy0); head.i16(gx1); head.i16(gy1);
    head.u16(0); head.u16(8); head.i16(2); head.i16(0); head.u16(0);
    // hhea
    const hhea = new W();
    hhea.fixed(1.0); hhea.i16(ascent); hhea.i16(descent); hhea.i16(0);
    let maxAdv = 0; for (const m of hmetrics) if (m.adv > maxAdv) maxAdv = m.adv;
    hhea.u16(maxAdv); hhea.i16(0); hhea.i16(0); hhea.i16(gx1);
    hhea.i16(1); hhea.i16(0); hhea.i16(0);
    hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0); hhea.i16(0);
    hhea.u16(glyphs.length);
    // maxp 1.0
    const maxp = new W();
    maxp.fixed(1.0);
    maxp.u16(glyphs.length);
    maxp.u16(maxPoints); maxp.u16(maxContours);
    maxp.u16(0); maxp.u16(0); maxp.u16(1); maxp.u16(0); maxp.u16(0); maxp.u16(0);
    maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0); maxp.u16(0);
    // OS/2 v0 (78 bytes exactos — Chrome la exige completa)
    const pairs = [];
    glyphs.forEach((g, i) => { if (g.code) pairs.push([g.code, i]); });
    pairs.sort((a, b) => a[0] - b[0]);
    const codes = pairs.map(p => p[0]);
    const os2 = new W();
    os2.u16(0); os2.u16(maxAdv); os2.u16(400); os2.u16(5); os2.u16(0);
    for (let i = 0; i < 10; i++) os2.i16(0); // subscript/superscript/strikeout
    os2.u16(0); // sFamilyClass
    for (let i = 0; i < 10; i++) os2.u8(0); // panose
    os2.u32(1); os2.u32(0); os2.u32(0); os2.u32(0); // ulUnicodeRange (bit0: latin básico)
    os2.str('MCF ');
    os2.u16(0x0040); // fsSelection: regular
    os2.u16(codes.length ? Math.min(...codes) : 0);
    os2.u16(codes.length ? Math.max(...codes) : 0);
    os2.i16(ascent); os2.i16(descent); os2.i16(0);
    os2.u16(ascent); os2.u16(-descent);
    // name, cmap
    const name = buildName(family);
    const cmap41 = buildCmap(pairs);
    const cmap = new W(); cmap.u16(0); cmap.u16(1); cmap.u16(3); cmap.u16(1); cmap.u32(12); cmap.bytes(cmap41);
    // hmtx, loca, post
    const hmtx = new W();
    for (const m of hmetrics) { hmtx.u16(m.adv); hmtx.i16(m.lsb); }
    const locaW = new W();
    for (const o of locaShort) locaW.u16(o);
    const post = new W(); post.fixed(3.0); post.fixed(0); post.i16(0); post.i16(0); post.u32(0); post.u32(0); post.u32(0); post.u32(0); post.u32(0);
    // directorio
    const tables = [
      ['OS/2', os2.b], ['cmap', cmap.b], ['glyf', glyf], ['head', head.b],
      ['hhea', hhea.b], ['hmtx', hmtx.b], ['loca', locaW.b], ['maxp', maxp.b],
      ['name', name], ['post', post.b],
    ];
    if (opts.altGroups && opts.altGroups.length) tables.push(['GSUB', buildGSUB(opts.altGroups)]);
    tables.sort((a, b) => a[0] < b[0] ? -1 : 1);
    const n = tables.length;
    const dir = new W();
    dir.u32(0x00010000); dir.u16(n);
    const p2 = 1 << Math.floor(Math.log2(n));
    dir.u16(p2 * 16); dir.u16(Math.log2(p2)); dir.u16(n * 16 - p2 * 16);
    let offset = 12 + 16 * n;
    const recs = [];
    for (const [tag, data] of tables) {
      const len = data.length, padded = len + ((4 - len % 4) % 4);
      recs.push({ tag, data, offset, len });
      offset += padded;
    }
    for (const r of recs) { dir.str(r.tag); dir.u32(checksum(r.data.concat(new Array((4 - r.len % 4) % 4).fill(0)))); dir.u32(r.offset); dir.u32(r.len); }
    const out = dir.b.slice();
    for (const r of recs) { while (out.length < r.offset) out.push(0); out.push(...r.data); while (out.length % 4) out.push(0); }
    // checkSumAdjustment
    let sum = 0;
    for (let i = 0; i < out.length; i += 4) sum = (sum + ((out[i] << 24) | (out[i + 1] << 16) | (out[i + 2] << 8) | out[i + 3])) >>> 0;
    const adj = (0xB1B0AFBA - sum) >>> 0;
    const headRec = recs.find(r => r.tag === 'head');
    const p = headRec.offset + 8;
    out[p] = (adj >>> 24) & 255; out[p + 1] = (adj >>> 16) & 255; out[p + 2] = (adj >>> 8) & 255; out[p + 3] = adj & 255;
    return new Uint8Array(out);
  }

  E.ttf = { buildTTF, buildGlyph, checksum };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
