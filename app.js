/* myCoolFont app — vistas funcionales (M5). Todo local, sin subidas.
   Modelo: MCF.glyphs = { "A": [{loops, boxW, boxH, from:'draw'|'photo'}, ...] } (0-3 variantes) */
'use strict';

// Estado global (sin esto ninguna vista se mira)
const MCF = {
  charset: 'mate',
  glyphs: {},
  fontBytes: null,
};

/* ---------- utilidades ---------- */
function el(html) { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
function download(bytes, name, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// canvas -> {loops, boxW, boxH} | null (vacío).
// mode 'draw': umbral fijo (la guía clara nunca es tinta). 'photo': Otsu.
function captureCanvas(cv, mode) {
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, cv.width, cv.height);
  const luma = MCFE.raster.grayscale({ data: img.data, width: cv.width, height: cv.height });
  let binary;
  if (mode === 'draw') {
    binary = new Uint8Array(luma.length);
    for (let i = 0; i < luma.length; i++) binary[i] = luma[i] < 128 ? 1 : 0;
  } else {
    binary = MCFE.raster.thresholdOtsu(luma).binary;
  }
  const comps = MCFE.raster.components(binary, cv.width, cv.height, 15);
  if (!comps.length) return null;
  comps.sort((a, b) => b.area - a.area);
  const c = MCFE.raster.crop(binary, cv.width, cv.height, comps[0], 3);
  const loops = MCFE.trace.traceContours(c);
  if (!loops.length) return null;
  return { loops, boxW: c.w, boxH: c.h };
}
function drawLoops(cv, loops, boxW, boxH) {
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#111';
  const s = Math.min(W / boxW, H / boxH) * 0.9;
  const ox = (W - boxW * s) / 2, oy = (H - boxH * s) / 2;
  for (const g of loops) {
    for (const loop of [g.outer, ...g.holes]) {
      ctx.beginPath();
      loop.forEach((p, i) => { const X = ox + p[0] * s, Y = oy + p[1] * s; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.closePath(); ctx.fill('evenodd');
    }
  }
}
// specs para el constructor desde MCF.glyphs
function currentSpecs(extraSynth, intensity) {
  const specs = [];
  for (const ch of Object.keys(MCF.glyphs)) {
    const vs = MCF.glyphs[ch];
    if (!vs.length) continue;
    const b = vs[0];
    const realExtra = vs.slice(1).map(v => v.loops);
    const wantTotal = Math.max(extraSynth | 0, 0);
    specs.push({
      code: ch.codePointAt(0), variants: [b.loops, ...realExtra],
      boxW: b.boxW, boxH: b.boxH,
      synth: Math.max(0, wantTotal - realExtra.length),
      intensity: intensity == null ? 0.5 : intensity, seed: ch.codePointAt(0),
    });
  }
  return specs;
}

/* ---------- vistas ---------- */
const VIEWS = {
  plantilla(v) {
    v.innerHTML = `<h2>Plantilla</h2>
      <p>Charset: <select id="cs">${MCFE.charset.names().map(n => `<option ${n === MCF.charset ? 'selected' : ''}>${n}</option>`).join('')}</select></p>
      <p class="mut">Opción A: dibuja directo en la pestaña <b>Dibujar</b> (recomendado en tu Tab).<br>
      Opción B: imprime una cuadrícula, rayala con plumón negro (una letra por cuadro) y súbela en <b>Foto</b>.</p>
      <button class="action" id="genGrid">Generar cuadrícula imprimible</button>
      <div id="pg"></div>`;
    v.querySelector('#cs').onchange = e => { MCF.charset = e.target.value; };
    v.querySelector('#genGrid').onclick = () => {
      const order = MCFE.charset.order(MCF.charset);
      const pg = v.querySelector('#pg'); pg.innerHTML = '';
      const c = document.createElement('canvas');
      const cols = 8, cw = 90, chh = 110;
      c.width = cols * cw; c.height = Math.ceil(order.length / cols) * chh;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.strokeStyle = '#999'; x.fillStyle = '#999'; x.font = '12px sans-serif';
      order.forEach((ch, i) => {
        const cx = (i % cols) * cw, cy = Math.floor(i / cols) * chh;
        x.strokeRect(cx + 5, cy + 5, cw - 10, chh - 10);
        x.fillText(ch, cx + 9, cy + 20);
      });
      pg.appendChild(c);
      const b = el('<button class="action">Descargar PNG de plantilla</button>');
      b.onclick = () => c.toBlob(bl => download(bl, 'plantilla-mycoolfont.png', 'image/png'));
      pg.appendChild(b);
    };
  },

  dibujar(v) {
    const order = MCFE.charset.order(MCF.charset);
    v.innerHTML = `<h2>Dibujar con tu lapicito</h2>
      <p class="mut">Raya cada letra. Tienes 3 celdas por letra (v1 v2 v3) = variantes reales.
      Con 1 basta; con 2-3 ya parece manuscrito de verdad.</p>
      <p>Letra: <select id="ch"></select> <span id="cnt" class="mut"></span></p>
      <div id="cells" style="display:flex;gap:.6rem;flex-wrap:wrap"></div>
      <p><button class="action" id="save">Guardar variantes</button> <span id="msg" class="mut"></span></p>`;
    const sel = v.querySelector('#ch');
    order.forEach(ch => { const o = document.createElement('option'); o.textContent = ch; sel.appendChild(o); });
    const cells = v.querySelector('#cells');
    const canvases = [];
    const paint = (ch) => {
      cells.innerHTML = ''; canvases.length = 0;
      const saved = MCF.glyphs[ch] || [];
      v.querySelector('#cnt').textContent = `${saved.length}/3 guardadas`;
      for (let i = 0; i < 3; i++) {
        const box = el(`<div class="cell"><span class="lbl">v${i + 1}</span></div>`);
        const cv = document.createElement('canvas');
        cv.width = 220; cv.height = 180;
        box.appendChild(cv); cells.appendChild(box);
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.strokeStyle = '#ddd'; ctx.beginPath();
        ctx.moveTo(0, 150); ctx.lineTo(220, 150); ctx.stroke(); // baseline
        if (saved[i]) drawLoops(cv, saved[i].loops, saved[i].boxW, saved[i].boxH);
        let drawing = false, last = null;
        const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
        cv.addEventListener('pointerdown', e => { drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); });
        cv.addEventListener('pointermove', e => {
          if (!drawing) return;
          const p = pos(e), pr = e.pressure > 0 ? e.pressure : 0.5;
          ctx.strokeStyle = '#111'; ctx.lineCap = 'round';
          ctx.lineWidth = 5 + pr * 9;
          ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
          last = p;
        });
        cv.addEventListener('pointerup', () => drawing = false);
        const clr = el('<button>Limpiar</button>');
        clr.onclick = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(0, 150); ctx.lineTo(220, 150); ctx.stroke(); };
        box.appendChild(clr);
        canvases.push(cv);
      }
    };
    sel.onchange = () => paint(sel.value);
    paint(sel.value);
    v.querySelector('#save').onclick = () => {
      const ch = sel.value, arr = MCF.glyphs[ch] = MCF.glyphs[ch] || [];
      let n = 0;
      canvases.forEach((cv, i) => {
        const cap = captureCanvas(cv, 'draw');
        if (cap) { arr[i] = { ...cap, from: 'draw' }; n++; }
      });
      v.querySelector('#msg').textContent = n ? `Guardadas ${n} variante(s) de "${ch}".` : 'Celdas vacías, nada que guardar.';
      paint(ch);
    };
  },

  foto(v) {
    v.innerHTML = `<h2>Foto del papel</h2>
      <p class="mut">Sube la foto de tu plantilla rayada. Detecto las letras, tú les pones etiqueta y las guardas.</p>
      <input type="file" id="fi" accept="image/*"><br><br>
      <canvas id="pv" style="max-width:100%"></canvas>
      <div id="crops" class="grid" style="margin-top:.6rem"></div>`;
    v.querySelector('#fi').onchange = e => {
      const f = e.target.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, 1400 / img.width);
        const cv = v.querySelector('#pv');
        cv.width = img.width * sc; cv.height = img.height * sc;
        const ctx = cv.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        const id = ctx.getImageData(0, 0, cv.width, cv.height);
        const luma = MCFE.raster.grayscale({ data: id.data, width: cv.width, height: cv.height });
        const { binary } = MCFE.raster.thresholdOtsu(luma);
        const comps = MCFE.raster.components(binary, cv.width, cv.height, 60);
        const order = MCFE.charset.order(MCF.charset);
        const box = v.querySelector('#crops'); box.innerHTML = '';
        comps.slice(0, 120).forEach((b, i) => {
          const c = MCFE.raster.crop(binary, cv.width, cv.height, b, 3);
          const cell = el(`<div class="cell"><span class="lbl">#${i + 1}</span></div>`);
          const cc = document.createElement('canvas');
          cc.width = c.w; cc.height = c.h;
          const cx = cc.getContext('2d'), im = cx.createImageData(c.w, c.h);
          for (let k = 0; k < c.w * c.h; k++) { const t = c.data[k] ? 0 : 255; im.data[k * 4] = im.data[k * 4 + 1] = im.data[k * 4 + 2] = t; im.data[k * 4 + 3] = 255; }
          cx.putImageData(im, 0, 0);
          const s = document.createElement('select');
          order.forEach(ch => { const o = document.createElement('option'); o.textContent = ch; s.appendChild(o); });
          s.selectedIndex = i % order.length;
          const g = el('<button>Guardar</button>');
          g.onclick = () => {
            const loops = MCFE.trace.traceContours(c);
            if (!loops.length) { g.textContent = 'vacío'; return; }
            const arr = MCF.glyphs[s.value] = MCF.glyphs[s.value] || [];
            if (arr.length < 3) arr.push({ loops, boxW: c.w, boxH: c.h, from: 'photo' });
            g.textContent = `✓ ${s.value} (${arr.length}/3)`;
          };
          cell.append(cc, s, g); box.appendChild(cell);
        });
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
    };
  },

  letras(v) {
    const keys = Object.keys(MCF.glyphs).filter(k => MCF.glyphs[k].length);
    v.innerHTML = `<h2>Letras capturadas (${keys.length})</h2>
      <p class="mut">Todo lo que dibujaste o subiste, con sus variantes.</p><div class="grid" id="g"></div>`;
    const g = v.querySelector('#g');
    if (!keys.length) { g.innerHTML = '<p class="mut">Vacío. Ve a Dibujar o Foto.</p>'; return; }
    keys.sort().forEach(ch => {
      const cell = el(`<div class="cell"><span class="lbl">${ch} ×${MCF.glyphs[ch].length}</span></div>`);
      MCF.glyphs[ch].forEach(vr => {
        const cv = document.createElement('canvas');
        cv.width = 100; cv.height = 80;
        drawLoops(cv, vr.loops, vr.boxW, vr.boxH);
        cell.appendChild(cv);
      });
      const del = el('<button>Borrar</button>');
      del.onclick = () => { delete MCF.glyphs[ch]; VIEWS.letras(v); };
      cell.appendChild(del); g.appendChild(cell);
    });
  },

  previa(v) {
    v.innerHTML = `<h2>Vista previa con tu fuente</h2>
      <p>Alternates sintéticas extra: <select id="syn"><option>0</option><option selected>2</option><option>1</option></select>
      Intensidad: <select id="inten"><option>0.3</option><option selected>0.5</option><option>0.7</option></select>
      <button class="action" id="build">Construir y probar</button></p>
      <textarea id="txt" rows="3" style="width:100%">2+2=4  7×8=56  El niño juega ¿por qué? ¡Ñandú!</textarea>
      <div id="out" style="font-size:2rem;margin-top:.6rem;min-height:3rem"></div>
      <p class="mut" id="info"></p>`;
    v.querySelector('#build').onclick = () => {
      const specs = currentSpecs(+v.querySelector('#syn').value, +v.querySelector('#inten').value);
      if (!specs.length) { v.querySelector('#info').textContent = 'No hay letras. Captura primero.'; return; }
      const { ttf } = MCFE.fontbuild.buildFontWithVariants(specs, 'MyCoolFont');
      MCF.fontBytes = ttf;
      const url = URL.createObjectURL(new Blob([ttf], { type: 'font/ttf' }));
      const ff = new FontFace('MCFPrev', `url(${url})`);
      ff.load().then(f => {
        document.fonts.add(f);
        const o = v.querySelector('#out');
        o.style.fontFamily = 'MCFPrev';
        o.style.fontFeatureSettings = '"calt" on';
        o.textContent = v.querySelector('#txt').value;
        v.querySelector('#info').textContent = `${specs.length} glifos, ${(ttf.length / 1024).toFixed(1)} KB. Escribe arriba y se actualiza al reconstruir.`;
      });
    };
  },

  descargar(v) {
    v.innerHTML = `<h2>Descargar tu fuente</h2>
      <p>Nombre: <input type="text" id="nm" value="MiCoolFont">
      Alternates sintéticas extra: <select id="syn"><option>0</option><option selected>2</option><option>1</option></select></p>
      <p><button class="action" id="dT">Descargar .ttf</button>
      <button class="action" id="dW">Descargar .woff</button></p>
      <p class="mut" id="info">Se construye al momento con tus letras + variantes reales y sintéticas (calt incluido).</p>`;
    const build = () => {
      const specs = currentSpecs(+v.querySelector('#syn').value, 0.5);
      if (!specs.length) { v.querySelector('#info').textContent = 'No hay letras.'; return null; }
      return MCFE.fontbuild.buildFontWithVariants(specs, v.querySelector('#nm').value || 'MiCoolFont');
    };
    v.querySelector('#dT').onclick = () => {
      const r = build(); if (!r) return;
      download(r.ttf, (v.querySelector('#nm').value || 'MiCoolFont') + '.ttf', 'font/ttf');
    };
    v.querySelector('#dW').onclick = async () => {
      const r = build(); if (!r) return;
      const woff = await MCFE.woff.ttfToWoff(r.ttf);
      download(woff, (v.querySelector('#nm').value || 'MiCoolFont') + '.woff', 'font/woff');
    };
  },
};

function go(name) {
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  VIEWS[name](document.getElementById('view'));
}
document.getElementById('nav').addEventListener('click', e => {
  if (e.target.dataset.view) go(e.target.dataset.view);
});
go('plantilla');
