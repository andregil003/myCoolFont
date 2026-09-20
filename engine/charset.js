/* myCoolFont engine/charset — orden de caracteres por charset (propio).
   Los codepoints son hechos, no código de nadie. */
'use strict';
var MCFE = (typeof window !== 'undefined') ? (window.MCFE = window.MCFE || {}) : (globalThis.MCFE = globalThis.MCFE || {});

(function (E) {
  const MINIMAL = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:!?\'"-()@#&+/$'];
  const SPANISH = [...MINIMAL, ...'ÑñÁÉÍÓÚÜáéíóúü¿¡'];
  const MATE = [...SPANISH, ...'×÷=≠%*[]{}_^°±√≤≥'];
  const ORDER = { minimal: MINIMAL, spanish: SPANISH, mate: MATE };
  E.charset = {
    order(name) { return (ORDER[name] || ORDER.mate).slice(); },
    names() { return Object.keys(ORDER); },
  };
})(MCFE);

if (typeof module !== 'undefined') module.exports = MCFE;
