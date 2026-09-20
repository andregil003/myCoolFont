#!/usr/bin/env node
'use strict';
process.noDeprecation = true; // silencia DEP0190 (usamos shell solo para shims .cmd en Windows)
// myCoolFont — tu letra hecha fuente. CLI unificado sobre:
//   draw-your-font (foto -> TTF) + jitter (variantes calt) + myfont (variantes reales)
// Autor: Jorge André Gil Leonardo — MIT. 100% local, nada se sube.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { CHARSETS, charsOf } = require('../lib/charsets');

const VERSION = '1.0.0';
const REPOS = {
  dyf: path.join(__dirname, '..', '..', 'draw-your-font'),
  jitter: path.join(__dirname, '..', '..', 'jitter'),
  myfont: path.join(__dirname, '..', '..', 'myfont-variantas'),
};

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
function has(flag) { return process.argv.includes(flag); }

// draw-your-font: usa el clon local si tiene deps, si no npx (no requiere instalar nada)
function dyfCmd() {
  const cli = path.join(REPOS.dyf, 'src', 'cli.js');
  if (fs.existsSync(cli)) {
    try { require.resolve('sharp', { paths: [path.dirname(cli)] }); return ['node', cli]; }
    catch { /* sin deps -> npx */ }
  }
  return ['npx', '-y', 'draw-your-font'];
}

function run(cmd, args) {
  // En Windows los shims .cmd (npx, jitter vía cargo) requieren shell
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.error) { console.error(`\nNo se pudo ejecutar "${cmd}". Corre: mycoolfont doctor\nDetalle: ${r.error.message}`); process.exit(1); }
  process.exit(r.status ?? 1);
}

function help() {
  console.log(`
myCoolFont v${VERSION} — por Jorge André Gil Leonardo
Tu letra hecha fuente: tablet -> foto -> TTF con variantes.

  plantilla  genera el PDF para rayar en tu tablet
    mycoolfont plantilla -o plantilla.pdf --charset mate
    charsets: minimal | spanish | mate (default: mate)

  make       foto(s) -> fuente base .ttf (1 variante)
    mycoolfont make foto1.jpg foto2.jpg --charset mate --name "MateAndre"
    mycoolfont make foto.jpg --chars "ABCabc123" --name "MiLetra" --smooth 1 --formats ttf,woff2

  variantes  hornea 2-4 versiones por letra (ya no se ve sellada)
    mycoolfont variantes MateAndre.ttf --alternates 3 --intensity 0.5
    --reales  usa variantes REALES dibujadas (modo myfont, más chamba, más fiel)

  preview    prueba rápida tu .ttf con texto de muestra
    mycoolfont preview MateAndre-jittered.ttf --text "2+2=4, niño 7×8=56"

  render     texto con variación a SVG/PNG (para portadas, títulos)
    mycoolfont render "Hola mundo" --font MiLetra.ttf --output titulo.svg

  instalar   instala un .ttf en Windows (usuario actual, sin admin)
    mycoolfont instalar MateAndre-jittered.ttf

  doctor     revisa que todo esté instalado (node, draw-your-font, jitter, python...)

Flujo chilero (5 min):
  1. mycoolfont plantilla -o plantilla.pdf --charset mate
  2. la rayas en tu tablet con plumón negro, le tomas foto
  3. mycoolfont make foto.jpg --charset mate --name "MateAndre"
  4. mycoolfont variantes MateAndre.ttf --alternates 3
  5. mycoolfont instalar MateAndre-jittered.ttf
`);
}

function cmdPlantilla() {
  const out = arg('-o', 'plantilla-mycoolfont.pdf');
  const charset = arg('--charset', 'mate');
  charsOf(charset); // valida
  const [cmd, ...base] = dyfCmd();
  if (charset === 'mate') {
    // draw-your-font solo conoce minimal|spanish: generamos base spanish y
    // avisamos que los símbolos mate extra van en hoja libre con --chars
    console.log('Charset mate = spanish + símbolos de mate.');
    console.log('Paso 1: plantilla spanish. Paso 2 (opcional): hoja libre con: ' + CHARSETS.mate.filter(c => !CHARSETS.spanish.includes(c)).join(' '));
    run(cmd, [...base, 'template', '-o', out, '--charset', 'spanish']);
  } else {
    run(cmd, [...base, 'template', '-o', out, '--charset', charset]);
  }
}

function cmdMake() {
  const fotos = process.argv.slice(3).filter(a => !a.startsWith('--') && !a.startsWith('-'));
  // quita el primer token si es el subcomando repetido o valores ya consumidos
  const files = fotos.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  if (!files.length) { console.error('Uso: mycoolfont make foto1.jpg [foto2.jpg...] --charset mate --name "MateAndre"'); process.exit(1); }
  const name = arg('--name', 'MiLetra');
  const charset = arg('--charset', null);
  const chars = arg('--chars', null);
  const [cmd, ...base] = dyfCmd();
  const extra = [];
  if (chars) extra.push('--chars', chars);
  else if (charset) extra.push('--chars', charsOf(charset)); // orden conocido -> --chars siempre funciona
  else { console.error('Pasa --charset (minimal|spanish|mate) o --chars "ABC..."'); process.exit(1); }
  extra.push('--name', name);
  if (arg('--smooth', null)) extra.push('--smooth', arg('--smooth', null));
  if (arg('--weight', null)) extra.push('--weight', arg('--weight', null));
  if (arg('--formats', null)) extra.push('--formats', arg('--formats', null));
  run(cmd, [...base, 'make', ...files, ...extra]);
}

function cmdVariantes() {
  const font = process.argv.slice(3).find(a => /\.(ttf|otf)$/i.test(a));
  if (!font) { console.error('Uso: mycoolfont variantes MiLetra.ttf [--alternates 3] [--intensity 0.5]'); process.exit(1); }
  if (has('--reales')) {
    console.log(`
Modo REALES (variantes dibujadas por ti, motor myfont):
  1. cd "${REPOS.myfont}" y configura config.yaml (glyphs + variants por letra)
  2. python3 -m myfont gen            -> sheet.pdf
  3. rayas el sheet en tu tablet, exportas written.pdf
  4. python3 -m myfont build written.pdf  -> tu fuente con calt real
Requiere: python3 + poppler(pdftoppm) + potrace + scipy + fonttools + pdflatex.
Guía completa: skill myfont-variants.
`);
    return;
  }
  const alt = arg('--alternates', '3');
  const inten = arg('--intensity', '0.5');
  run('jitter', ['bake', font, '--alternates', alt, '--intensity', inten]);
}

function cmdPreview() {
  const font = process.argv.slice(3).find(a => /\.(ttf|otf)$/i.test(a));
  if (!font) { console.error('Uso: mycoolfont preview MiLetra.ttf [--text "..."]'); process.exit(1); }
  const text = arg('--text', '2+2=4  7×8=56  El niño juega ¿por qué? ¡Ñandú!');
  run('jitter', ['render', text, '--font', font, '--output', 'preview-mycoolfont.png']);
}

function cmdRender() {
  const text = process.argv[3] && !process.argv[3].startsWith('-') ? process.argv[3] : null;
  if (!text) { console.error('Uso: mycoolfont render "texto" --font MiLetra.ttf [--output titulo.svg]'); process.exit(1); }
  const font = arg('--font', null);
  if (!font) { console.error('Falta --font MiLetra.ttf'); process.exit(1); }
  const out = arg('--output', 'render-mycoolfont.svg');
  const extra = ['--output', out];
  if (arg('--intensity', null)) extra.push('--intensity', arg('--intensity', null));
  if (arg('--seed', null)) extra.push('--seed', arg('--seed', null));
  if (arg('--size', null)) extra.push('--size', arg('--size', null));
  run('jitter', ['render', text, '--font', font, ...extra]);
}

function cmdInstalar() {
  if (process.platform !== 'win32') { console.error('instalar solo está implementado en Windows (doble clic al .ttf en otros sistemas).'); process.exit(1); }
  const font = process.argv.slice(3).find(a => /\.ttf$/i.test(a));
  if (!font || !fs.existsSync(font)) { console.error('Uso: mycoolfont instalar MiLetra.ttf'); process.exit(1); }
  const dir = path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, path.basename(font));
  fs.copyFileSync(path.resolve(font), dest);
  const r = spawnSync('reg', ['add', 'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts', '/v', path.basename(font, '.ttf'), '/t', 'REG_SZ', '/d', dest, '/f'], { stdio: 'inherit' });
  if (r.status === 0) console.log(`\nInstalada: ${path.basename(font)} (reinicia Word/WPS si estaba abierto)`);
  else process.exit(r.status ?? 1);
}

function check(label, cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'pipe', shell: process.platform === 'win32' });
  const ok = !r.error && r.status === 0;
  console.log(`${ok ? '[OK]     ' : '[FALTA]  '} ${label}`);
  return ok;
}

function cmdDoctor() {
  console.log('myCoolFont doctor:\n');
  const node = check('node >= 18 (núcleo del CLI)', 'node', ['--version']);
  check('draw-your-font vía npx (foto -> TTF)', 'npx', ['-y', 'draw-your-font', '--help']);
  const hasJitter = check('jitter (variantes calt + render)', 'jitter', ['--help']);
  const hasPy = check('python (solo modo --reales/myfont)', 'python', ['--version']);
  if (hasPy) {
    check('  poppler pdftoppm (solo --reales)', 'pdftoppm', ['-v']);
    check('  potrace (solo --reales)', 'potrace', ['--version']);
  }
  console.log('');
  if (!hasJitter) console.log('Instala jitter: cargo install jitter  (o corre install.ps1)');
  if (!node) console.log('Instala Node 18+: https://nodejs.org');
  console.log('\nClon local draw-your-font: ' + (fs.existsSync(REPOS.dyf) ? 'detectado (modo local, más rápido)' : '(no encontrado, se usa npx)'));
}

const sub = process.argv[2];
if (!sub || sub === '--help' || sub === '-h') help();
else if (sub === '--version' || sub === '-v') console.log(VERSION);
else if (sub === 'plantilla') cmdPlantilla();
else if (sub === 'make') cmdMake();
else if (sub === 'variantes') cmdVariantes();
else if (sub === 'preview') cmdPreview();
else if (sub === 'render') cmdRender();
else if (sub === 'instalar') cmdInstalar();
else if (sub === 'doctor') cmdDoctor();
else { console.error(`Subcomando desconocido: ${sub}`); help(); process.exit(1); }
