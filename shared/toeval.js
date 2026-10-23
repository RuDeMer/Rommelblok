// Toeval met een zaadje: altijd dezelfde reeks voor hetzelfde zaadje.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).

// ---------------- toeval met een zaadje
function rng(zaad) {
  let a = zaad >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hsh(a, b, c, d) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1) ^ Math.imul(d | 0, 0x85ebca77);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return h >>> 0;
}
const kans = (a, b, c, d) => hsh(a, b, c, d) / 4294967296;
function zaadVan(tekst) {
  tekst = String(tekst == null ? '' : tekst).trim();
  if (/^-?\d{1,15}$/.test(tekst)) return (Number(tekst) % 4294967296 + 4294967296) % 4294967296 >>> 0;
  let h = 2166136261; for (let i = 0; i < tekst.length; i++) { h ^= tekst.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export {
  rng, hsh, kans, zaadVan,
};
