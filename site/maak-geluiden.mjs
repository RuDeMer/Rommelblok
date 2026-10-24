// Maakt client/geluiden/rommelblok-geluiden.bin en client/geluiden/BRONNEN.md uit opnames met de licentie CC0:
//   node site/maak-geluiden.mjs
// Alleen nodig als de geluiden veranderen (het .bin-bestand staat in de repository). Heeft internet, curl, unzip en
// ffmpeg nodig. De opnames komen van Kenney (kenney.nl) en BigSoundBank (bigsoundbank.com), allebei CC0 1.0.
//
// Elk geluid wordt geknipt (stilte ervoor en erna eraf, een korte fade), even hard gemaakt en als klein mono-MP3'tje
// opgeslagen (zonder Xing-kopje: de stilte die de MP3-coder ervoor zet, knipt de pagina zelf weg). Het bestand: 'RBG1', de lengte van de kop (4 bytes, little endian), de kop als JSON
// ({ v, klanken: { naam: [[begin, lengte], ...] } }, posities in de data na de kop) en daarna alle MP3'tjes achter elkaar.
// De pagina haalt het pas op als het spel al loopt; zonder dit bestand klinkt alles zoals vroeger (zelfgemaakt).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url)), WORTEL = path.join(HIER, '..');
const UIT = path.join(WORTEL, 'client', 'geluiden');
const BRON = path.join(os.tmpdir(), 'rommelblok-geluiden-bron');

// ---------- de bronnen
const KENNEY = {
  impact: { titel: 'Impact Sounds (Kenney)', pagina: 'https://kenney.nl/assets/impact-sounds', zip: 'https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip' },
  rpg: { titel: 'RPG Audio (Kenney)', pagina: 'https://kenney.nl/assets/rpg-audio', zip: 'https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip' },
};
const BSB = {
  2382: ['Cow moos #2', 'cow-moos-2-s2382'], 2383: ['Cow moos #3', 'cow-moos-3-s2383'], 2386: ['Cow moos #6', 'cow-moos-6-s2386'],
  2343: ['Sheep #1', 'sheep-1-s2343'], 2344: ['Sheep #2', 'sheep-2-s2344'], 2345: ['Sheep #3', 'sheep-3-s2345'], 2347: ['Sheep #5', 'sheep-5-s2347'],
  453: ['Annoyed hen', 'annoyed-hen-s0453'],
};
const k = (pak, n) => ({ pak, n });
const reeks = (pak, basis, nrs) => nrs.map(i => k(pak, basis + String(i).padStart(3, '0')));

// ---------- welke geluiden er zijn. sr: samplefrequentie, kbps: bitrate, van/tot: welk stuk (seconden), max: hooguit zo lang
const KLANKEN = {
  // voetstappen per ondergrond
  stap_steen: { uit: reeks('impact', 'footstep_concrete_', [0, 1, 2, 3, 4]) },
  stap_hout: { uit: reeks('impact', 'footstep_wood_', [0, 1, 2, 3, 4]), max: 0.2 },
  stap_gras: { uit: reeks('impact', 'footstep_grass_', [0, 1, 2, 3, 4]), max: 0.28 },
  stap_sneeuw: { uit: reeks('impact', 'footstep_snow_', [0, 1, 2, 3]), max: 0.3 },
  stap_stof: { uit: reeks('impact', 'footstep_carpet_', [0, 1, 2, 3, 4]) },
  stap_aarde: { uit: [0, 1, 2, 4, 6, 8].map(i => k('rpg', 'footstep0' + i)) },
  // hakken, breken en neerzetten per materiaal
  hak_steen: { uit: reeks('impact', 'impactMining_', [0, 1, 2, 3]), max: 0.3 },
  plaats_steen: { uit: reeks('impact', 'impactGeneric_light_', [0, 1, 2, 3]) },
  hak_hout: { uit: [k('rpg', 'chop'), ...reeks('impact', 'impactWood_light_', [0, 1, 2])], max: 0.25 },
  breek_hout: { uit: reeks('impact', 'impactPlank_medium_', [0, 1, 2]), max: 0.45 },
  plaats_hout: { uit: reeks('impact', 'impactWood_medium_', [0, 1, 2, 3]), max: 0.28 },
  glas_tik: { uit: reeks('impact', 'impactGlass_light_', [0, 1, 2]) },
  glas_breek: { uit: reeks('impact', 'impactGlass_heavy_', [0, 1, 2, 4]) },
  metaal_tik: { uit: reeks('impact', 'impactMetal_light_', [0, 1, 2, 4]), max: 0.3 },
  metaal_zwaar: { uit: reeks('impact', 'impactMetal_heavy_', [0, 1, 3]), max: 0.3 },
  zacht: { uit: reeks('impact', 'impactSoft_medium_', [0, 1, 2, 3]) },
  zacht_zwaar: { uit: reeks('impact', 'impactSoft_heavy_', [0, 1, 2, 3]), max: 0.35 },
  stof: { uit: ['cloth2', 'cloth3', 'cloth4'].map(n => k('rpg', n)), max: 0.35 },
  // vechten
  sla: { uit: reeks('impact', 'impactPunch_medium_', [0, 1, 2, 3]), max: 0.3 },
  klap: { uit: reeks('impact', 'impactPunch_heavy_', [0, 1, 2]), max: 0.35 },
  // deuren, kisten, de oven en de rugzak
  deur_open: { uit: [k('rpg', 'doorOpen_1'), k('rpg', 'doorOpen_2')], sr: 16000, kbps: 32, max: 0.9 },
  deur_dicht: { uit: ['doorClose_1', 'doorClose_2', 'doorClose_3', 'doorClose_4'].map(n => k('rpg', n)), sr: 16000, kbps: 32 },
  kist_open: { uit: [k('rpg', 'creak1'), k('rpg', 'creak3')], sr: 16000, kbps: 32 },
  kist_dicht: { uit: [k('rpg', 'bookClose'), k('rpg', 'bookPlace1')] },
  klink: { uit: [k('rpg', 'metalLatch'), k('rpg', 'metalClick')] },
  rugzak: { uit: [k('rpg', 'handleSmallLeather'), k('rpg', 'handleSmallLeather2')] },
  // dieren
  koe: { uit: [2382, 2383, 2386].map(n => ({ bsb: n })), sr: 16000, kbps: 32, max: 1.7, drempel: 0.1 },
  schaap: { uit: [2343, 2344, 2345, 2347].map(n => ({ bsb: n })) },
  kip: { uit: [{ bsb: 453, van: 0.05, tot: 0.76 }, { bsb: 453, van: 1.73, tot: 2.32 }, { bsb: 453, van: 2.53, tot: 3.2 }] },
  kip_au: { uit: [{ bsb: 453, van: 0.26, tot: 0.42 }, { bsb: 453, van: 0.64, tot: 0.8 }] },
};

// ---------- downloaden (een keer; daarna uit de tijdelijke map)
fs.mkdirSync(BRON, { recursive: true });
const haal = (url, doel) => { if (!fs.existsSync(doel)) execFileSync('curl', ['-sSfL', '-o', doel, url]); return doel; };
for (const [n, p] of Object.entries(KENNEY)) {
  const map = path.join(BRON, n);
  if (!fs.existsSync(map)) { const z = haal(p.zip, path.join(BRON, n + '.zip')); fs.mkdirSync(map); execFileSync('unzip', ['-q', z, '-d', map]); }
}
const bsbPad = n => haal(`https://bigsoundbank.com/UPLOAD/ogg/${String(n).padStart(4, '0')}.ogg`, path.join(BRON, 'bsb-' + n + '.ogg'));
const kenneyPad = (pak, n) => path.join(BRON, pak, 'Audio', n + '.ogg');

// ---------- knippen en inpakken
function lees(p, sr) {
  const b = execFileSync('ffmpeg', ['-v', 'error', '-i', p, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { maxBuffer: 1 << 28 });
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
function knip(x, sr, o) {
  let a = Math.floor((o.van || 0) * sr), b = Math.min(x.length, o.tot ? Math.floor(o.tot * sr) : x.length);
  let s = x.slice(a, b), piek = 0;
  for (const v of s) piek = Math.max(piek, Math.abs(v));
  if (!piek) throw new Error('stil');
  s = s.map(v => v * 0.89 / piek);
  // begin: het eerste stuk boven de drempel (min 2 ms), einde: waar het gemiddelde (10 ms) onder -46 dB blijft
  const drempel = o.drempel || 0.02, h = Math.floor(sr * 0.01);
  let begin = 0; while (begin < s.length && Math.abs(s[begin]) < drempel) begin++;
  begin = Math.max(0, begin - Math.floor(sr * 0.002));
  let eind = s.length;
  for (let i = s.length - h; i > begin; i -= h) { let e = 0; for (let j = i; j < i + h; j++) e += s[j] * s[j]; if (Math.sqrt(e / h) > 0.005) { eind = Math.min(s.length, i + 2 * h); break; } }
  if (o.max) eind = Math.min(eind, begin + Math.floor(o.max * sr));
  s = s.slice(begin, eind);
  const fin = Math.floor(sr * 0.002), fuit = Math.min(Math.floor(sr * 0.04), Math.floor(s.length * 0.25));
  for (let i = 0; i < fin; i++) s[i] *= i / fin;
  for (let i = 0; i < fuit; i++) s[s.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / fuit);
  return s;
}
function mp3(s, sr, kbps) {
  return execFileSync('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ar', String(sr), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-b:a', kbps + 'k', '-write_xing', '0', '-id3v2_version', '0', '-f', 'mp3', '-'], { input: Buffer.from(s.buffer), maxBuffer: 1 << 26 });
}
const delen = [], kop = { v: 1, klanken: {} }, regels = [];
let pos = 0, duur = 0;
for (const [naam, def] of Object.entries(KLANKEN)) {
  const sr = def.sr || 22050, kbps = def.kbps || 40;
  kop.klanken[naam] = [];
  for (const u of def.uit) {
    const o = Object.assign({ max: def.max, drempel: def.drempel }, u);
    const p = u.bsb ? bsbPad(u.bsb) : kenneyPad(u.pak, u.n);
    const s = knip(lees(p, sr), sr, o), b = mp3(s, sr, kbps);
    kop.klanken[naam].push([pos, b.length]); delen.push(b); pos += b.length; duur += s.length / sr;
    const stuk = u.van !== undefined ? ` (${u.van}–${u.tot} s)` : '';
    regels.push(u.bsb
      ? `| ${naam} | ${BSB[u.bsb][0]}${stuk} | Joseph Sardin, [BigSoundBank](https://bigsoundbank.com/${BSB[u.bsb][1]}.html) | CC0 1.0 |`
      : `| ${naam} | ${u.n}.ogg | Kenney, [${KENNEY[u.pak].titel}](${KENNEY[u.pak].pagina}) | CC0 1.0 |`);
  }
}
const kopB = Buffer.from(JSON.stringify(kop)), lengte = Buffer.alloc(4); lengte.writeUInt32LE(kopB.length);
const alles = Buffer.concat([Buffer.from('RBG1'), lengte, kopB, ...delen]);
fs.mkdirSync(UIT, { recursive: true });
fs.writeFileSync(path.join(UIT, 'rommelblok-geluiden.bin'), alles);
fs.writeFileSync(path.join(UIT, 'BRONNEN.md'), `# Geluiden van Rommelblok: bronnen en licentie

De meeste geluiden maakt het spel zelf (met de Web Audio API, zonder bestanden). Een deel komt uit opnames
met de licentie **CC0 1.0** (Creative Commons Zero, publiek domein: vrij te gebruiken, ook zonder naamsvermelding).
Ze staan samen in \`rommelblok-geluiden.bin\`, dat de pagina pas ophaalt als het spel al loopt.
Gemaakt met \`node site/maak-geluiden.mjs\` (geknipt, even hard gemaakt en als klein mono-MP3'tje ingepakt).

- Kenney: https://kenney.nl (Impact Sounds en RPG Audio), licentie CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/
- BigSoundBank, Joseph Sardin: https://bigsoundbank.com, licentie CC0 1.0: https://bigsoundbank.com/license.html

Met dank aan Kenney en Joseph Sardin (niet verplicht, wel gemeend).

| Geluid in het spel | Opname | Maker en bron | Licentie |
|---|---|---|---|
${regels.join('\n')}
`);
console.log('geluiden:', Object.keys(kop.klanken).length, 'soorten,', delen.length, 'stukjes,', duur.toFixed(1), 's,', (alles.length / 1024).toFixed(0), 'kB');
