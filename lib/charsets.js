'use strict';
// Charsets de myCoolFont — compatibles con draw-your-font (minimal/spanish)
// más el charset propio "mate" para números y operaciones.
// Autor: Jorge André Gil Leonardo (MIT)

const MINIMAL = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  ...'abcdefghijklmnopqrstuvwxyz',
  ...'0123456789',
  ...`.,;:!?'"-()@#&+/$`,
];

// Igual al upstream + Ü mayúscula (el original la olvida y en español hace falta)
const SPANISH = [...MINIMAL, ...'ÑñÁÉÍÓÚÜáéíóúü¿¡'];

// Español completo + símbolos de matemáticas para worksheets y apuntes
const MATE_EXTRA = [...'×÷=≠%*[]{}_^°±√≤≥'];
const MATE = [...SPANISH, ...MATE_EXTRA];

const CHARSETS = { minimal: MINIMAL, spanish: SPANISH, mate: MATE };

function charsOf(name) {
  const set = CHARSETS[name];
  if (!set) throw new Error(`Charset desconocido: ${name}. Usa: ${Object.keys(CHARSETS).join('|')}`);
  return set.join('');
}

module.exports = { CHARSETS, charsOf };
