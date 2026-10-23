// Wat de server nakijkt, als losse functies zonder netwerk (zo zijn ze apart te testen).
import { G } from '../../shared/index.js';

const { BL, IT, VAST, VORM, LAAG, VN, HOOG } = G;
const { BEREIK, SNEL } = G.SAMEN;

export const geheel = (v, a, b) => Number.isInteger(v) && v >= a && v <= b;
export const getal = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
export const OOG = 1.62;

// een vol blok waar je niet doorheen kunt (geen glas, bladeren, deuren, platen of trappen: daar zijn we coulant)
export function volBlok(v) { const id = v & 255; return v > 0 && !!VAST[id] && VORM[id] === VN.kubus && LAAG[id] === 0; }

// Loopt de lijn van voeten a naar voeten b dwars door een muur? Op heuphoogte (0,9 boven de voeten) in stapjes van 0,2:
// minstens drie stapjes achter elkaar in een vol blok. Een hoekje afsnijden bij een sprong telt dus niet.
// get(x, y, z) geeft -1 als dat stuk er (nog) niet is: dan weten we het niet, en dat telt niet als muur.
export function doorMuur(get, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], d = Math.hypot(dx, dy, dz);
  const n = Math.min(400, Math.ceil(d / 0.2));
  let rij = 0;
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = a[0] + dx * t, y = a[1] + dy * t + 0.9, z = a[2] + dz * t;
    if (volBlok(get(Math.floor(x), Math.floor(y), Math.floor(z)))) { if (++rij >= 3) return true; } else rij = 0;
  }
  return false;
}
// staat iemand met zijn heup in een vol blok?
export const zitVast = (get, p) => volBlok(get(Math.floor(p[0]), Math.floor(p[1] + 0.9), Math.floor(p[2])));

// Bewegen: een voorraad blokken die bijloopt met de snelste snelheid die mag (lopen, een karretje, vliegen), zodat een
// haperende verbinding (berichten die tegelijk aankomen) niet meteen als te snel telt. b = { h, v, t } van de speler.
export function bewegingGoed(b, van, naar, nu, vlag, bouwen) {
  const dt = Math.max(0, Math.min(5, (nu - b.t) / 1000)); b.t = nu;
  const vliegt = (vlag & 1) && bouwen, kar = vlag & 8;
  const snel = vliegt ? SNEL.vliegen : kar ? SNEL.kar : SNEL.grond;
  b.h = Math.min(SNEL.voorraad, b.h + snel * dt); b.v = Math.min(SNEL.voorraadOmhoog, b.v + SNEL.omhoog * dt);
  const dh = Math.hypot(naar[0] - van[0], naar[2] - van[2]), dy = naar[1] - van[1];
  b.h -= dh; if (dy > 0) b.v -= dy;
  return b.h > -1 && b.v > -1;
}

// binnen bereik: van je ogen tot het midden van het blok
export const binnenBereik = (p, x, y, z, extra = 0) => Math.hypot(x + 0.5 - p[0], y + 0.5 - (p[1] + OOG), z + 0.5 - p[2]) <= BEREIK + extra;

// een vak van een kist of oven: null, of { id, n, dur? } met een voorwerp dat bestaat
export function vakGoed(s) {
  if (s === null) return true;
  if (!s || typeof s !== 'object') return false;
  const it = IT[s.id]; if (!it || !geheel(s.n, 1, it.stapel || 64)) return false;
  if (s.dur !== undefined && s.dur !== null && !geheel(s.dur, 0, it.duur || 0)) return false;
  for (const k of Object.keys(s)) if (k !== 'id' && k !== 'n' && k !== 'dur') return false;
  return true;
}
export const schoonVak = s => (s ? Object.assign({ id: s.id, n: s.n }, s.dur != null ? { dur: s.dur } : {}) : null);

// een blokwaarde die kan bestaan (0 is lucht)
export const waardeGoed = v => geheel(v, 0, 65535) && (v === 0 || !!BL[v & 255]);
export const plekGoed = (x, y, z) => geheel(x, -3e7, 3e7) && geheel(z, -3e7, 3e7) && geheel(y, 1, HOOG - 1);

// iets op de grond
export const losGoed = (id, n, dur) => !!IT[id] && geheel(n, 1, IT[id].stapel || 64) && geheel(dur || 0, 0, IT[id].duur || 0);

// kisten en ovens
export const KIST = new Set([G.B.kist, G.B.buitkist]), OVEN = new Set([G.B.oven, G.B.oven_aan]);
export const soortDing = v => (KIST.has(v & 255) ? 'kist' : OVEN.has(v & 255) ? 'oven' : null);
export const OVENVAK = new Set(['in', 'brand', 'uit']);

// wat iemand die niet mag bouwen toch mag: een deur, luik of hekje open en dicht doen
const DEURVORM = new Set([VN.deur, VN.luik, VN.hek]);
export const alleenDeur = (oud, nieuw) => oud > 0 && (oud & 255) === (nieuw & 255) && DEURVORM.has(VORM[oud & 255]);
