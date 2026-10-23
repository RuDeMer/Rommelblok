// Hulpjes voor de servertests: een server op een vrije poort met een eigen database, en nagemaakte spelers.
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { leesInstellingen } from '../src/instellingen.js';
import { maakServer } from '../src/server.js';
import { G } from '../../shared/index.js';

export const HERKOMST = 'https://rubensrommelhoekje.nl';
export { G };

let fouten = 0;
export const goed = (b, t) => { console.log((b ? 'goed ' : 'FOUT ') + t); if (!b) fouten++; return b; };
export const fout = () => fouten;
export const wacht = ms => new Promise(ok => setTimeout(ok, ms));

export async function startServer(env = {}) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-server-'));
  const inst = leesInstellingen(Object.assign({ PORT: '0', DB_PAD: path.join(map, 'test.db'), BEHEER: 'een-lang-testwachtwoord' }, env));
  inst.stil = true;
  if (env.LEEG_WACHT) inst.leegWacht = Number(env.LEEG_WACHT);
  const server = maakServer(inst);
  const a = await server.luister();
  return { server, inst, poort: a.port, url: `ws://127.0.0.1:${a.port}${inst.pad}`, http: `http://127.0.0.1:${a.port}`, map };
}

// een nagemaakte speler: verbindt, onthoudt alle berichten en kan wachten op een bepaald bericht
export function speler(url, opties = {}) {
  const ws = new WebSocket(url, { headers: { Origin: opties.herkomst || HERKOMST }, headers2: undefined });
  const p = { ws, berichten: [], geheim: opties.geheim || randomBytes(16).toString('hex'), dicht: null, wachters: [] };
  ws.on('message', d => {
    const m = JSON.parse(d.toString()); p.berichten.push(m);
    for (const w of p.wachters.slice()) if (w.f(m)) { p.wachters.splice(p.wachters.indexOf(w), 1); w.ok(m); }
  });
  p.open = new Promise((ok, nee) => { ws.on('open', ok); ws.on('error', nee); ws.on('unexpected-response', (q, r) => nee(new Error('status ' + r.statusCode))); });
  p.gesloten = new Promise(ok => ws.on('close', (c) => { p.dicht = c; ok(c); }));
  p.stuur = m => ws.send(JSON.stringify(m));
  // wacht op een bericht dat aan f voldoet (ook als het al binnen is, vanaf 'vanaf')
  p.op = (f, ms = 8000, vanaf = 0) => {
    const al = p.berichten.slice(vanaf).find(f); if (al) return Promise.resolve(al);
    return new Promise((ok, nee) => { const w = { f, ok }; p.wachters.push(w); setTimeout(() => { const i = p.wachters.indexOf(w); if (i >= 0) { p.wachters.splice(i, 1); nee(new Error('niet gekregen binnen ' + ms + ' ms')); } }, ms); });
  };
  p.soort = (t, ms, vanaf) => p.op(m => m.t === t, ms, vanaf);
  p.hallo = extra => p.stuur(Object.assign({ t: 'hallo', v: G.SAMEN.PROTOCOL, geheim: p.geheim, naam: [1, 2], pop: G.POP.standaardPop(1), taal: 'nl', straal: 4 }, extra));
  p.sluit = () => { ws.close(); return p.gesloten; };
  return p;
}

// een nieuwe wereld maken en het welkom afwachten
export async function maakWereld(url, maak = {}, opties = {}) {
  const p = speler(url, opties); await p.open;
  p.hallo(Object.assign({ maak: Object.assign({ zaad: 12345, stand: 'overleven', moeilijk: 'makkelijk' }, maak) }, opties.hallo || {}));
  const w = await p.soort('welkom', 15000);
  return { p, w, code: w.nieuw && w.nieuw.code, sleutel: w.nieuw && w.nieuw.sleutel };
}
export async function doeMee(url, code, opties = {}) {
  const p = speler(url, opties); await p.open;
  p.hallo(Object.assign({ code }, opties.hallo || {}));
  const w = await p.op(m => m.t === 'welkom' || m.t === 'nee', 15000);
  return { p, w };
}
