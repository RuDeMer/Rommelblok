// Een blokwaarde lezen en maken. Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
//
// Een blok in een stuk is een getal van 16 bits (Uint16Array, zoals in de opslag).
//   tot nu toe:  bits 0-7 de soort (0 tot 255), bits 8-15 de stand
//   met ruimte:  bits 0-7 en 14-15 de soort (0 tot 1023), bits 8-13 de stand (0 tot 63)
// Zolang een soort onder de 256 blijft en een stand onder de 64, betekenen beide indelingen precies hetzelfde getal.
// Alle blokken die er nu zijn (tot 177) en alle standen die het spel maakt (hooguit 31) vallen daarbinnen: opgeslagen
// werelden hoeven dus nooit omgezet te worden. test/standen.js controleert dat.
//
// De oude code gebruikt nog `v & 255` en `v >> 8`; dat is gelijk zolang er geen blok 256 of hoger bestaat.
// Komt dat blok er, vervang die dan door soort(v) en stand(v) (test/standen.js waarschuwt dan).
export const SOORT_MAX = 1023, STAND_MAX = 63;
export const soort = v => (v & 255) | ((v >> 6) & 768);
export const stand = v => (v >> 8) & 63;
export const waarde = (s, st) => (s & 255) | ((s & 768) << 6) | ((st & 63) << 8);
