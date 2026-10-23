// De hoofddraad van de spelserver: het netwerk (http en WebSocket), de grenzen per verbinding, en welke wereld bij wie hoort.
// Elke gedeelde wereld draait in een eigen draad (kamer.js); hier komen alleen berichten langs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { randomBytes, randomInt, timingSafeEqual, createHash } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { G } from '../../shared/index.js';
import { openDb, hash } from './db.js';

const S = G.SAMEN;
const UUR = 3600e3, DAG = 24 * UUR;

export function maakServer(inst) {
  const db = openDb(inst.dbPad);
  db.opruimen();
  const opruimKlok = setInterval(() => { try { db.opruimen(); } catch (e) { console.error(e); } }, UUR);
  const g = inst.grens;
  const verbindingen = new Map(); // sid -> verbinding
  const kamers = new Map();       // wereld-id -> { worker, sids, leegKlok, klaar }
  const perAdres = new Map();     // ip -> aantal verbindingen (alleen in het geheugen)
  const nieuwPerAdres = new Map(); // ip -> [tijden van nieuwe werelden vandaag]
  const fouteCodes = new Map();   // ip -> [tijden van foute codes]
  const beheerFout = new Map();   // ip -> [tijden van een fout beheerwachtwoord]
  let volgende = 0;
  const log = (...a) => { if (!inst.stil) console.log(new Date().toISOString(), ...a); };
  const recent = (map, ip, ms) => { const l = (map.get(ip) || []).filter(t => Date.now() - t < ms); map.set(ip, l); return l; };

  // ---------------- kamers (een draad per open wereld)
  const stoppend = new Map(); // wereld-id -> belofte die klaar is als de draad helemaal gestopt is (en alles bewaard heeft)
  async function kamerVoor(id) {
    while (stoppend.has(id)) await stoppend.get(id);
    let k = kamers.get(id);
    if (k) { clearTimeout(k.leegKlok); k.leegKlok = null; return k; }
    if (kamers.size >= inst.maxActief) return null;
    const worker = new Worker(new URL('./kamer.js', import.meta.url), { workerData: { wereldId: id, dbPad: inst.dbPad, inst: { serverStraal: inst.serverStraal, grens: inst.grens } } });
    k = { id, worker, sids: new Set(), leegKlok: null };
    kamers.set(id, k);
    let gestopt;
    k.exit = new Promise(ok => { gestopt = ok; });
    worker.on('message', m => vanKamer(k, m));
    worker.on('error', e => { console.error('kamer', id, e); for (const sid of k.sids) sluitMet(sid, 'fout'); });
    worker.on('exit', () => { if (kamers.get(id) === k) kamers.delete(id); if (stoppend.get(id) === k.exit) stoppend.delete(id); for (const sid of k.sids) sluitMet(sid, 'fout'); gestopt(); });
    log('wereld open', id);
    return k;
  }
  function vanKamer(k, m) {
    if (m.t === 'naar') { for (const sid of m.sids) { const v = verbindingen.get(sid); if (v && v.ws.readyState === 1) v.ws.send(m.s); } }
    else if (m.t === 'sluit') { const v = verbindingen.get(m.sid); if (v) { if (v.kamer === k) { k.sids.delete(m.sid); v.kamer = null; } if (v.ws.readyState === 1) v.ws.send(m.s); setTimeout(() => v.ws.close(1000), 20); } }
    else if (m.t === 'leeg') {
      if (!k.sids.size && !k.leegKlok) k.leegKlok = setTimeout(() => { if (!k.sids.size && kamers.get(k.id) === k) stopKamer(k); }, inst.leegWacht ?? 60e3);
    } else if (m.t === 'gestopt') { if (kamers.get(k.id) === k) kamers.delete(k.id); log('wereld dicht', k.id, m.verwijderd ? '(verwijderd)' : ''); }
  }
  // een kamer stoppen: hij bewaart alles en gaat dan uit; tot dan wacht wie erin wil
  function stopKamer(k) { kamers.delete(k.id); stoppend.set(k.id, k.exit); k.worker.postMessage({ t: 'stop' }); setTimeout(() => k.worker.terminate(), 15e3).unref(); }
  function sluitMet(sid, reden) { const v = verbindingen.get(sid); if (!v) return; try { v.ws.send(JSON.stringify({ t: 'nee', reden })); } catch (e) { /* al dicht */ } v.ws.close(1000); }

  // ---------------- http: de status, het beheer, en (alleen bij tests) de pagina zelf
  const beheerOk = (req, ip) => {
    if (!inst.beheer) return false;
    if (recent(beheerFout, ip, 15 * 60e3).length >= 8) return false;
    const a = String(req.headers.authorization || ''), m = /^Bearer (.+)$/.exec(a);
    const h = x => createHash('sha256').update(String(x)).digest();
    const goed = !!m && timingSafeEqual(h(m[1]), h(inst.beheer));
    if (!goed) beheerFout.get(ip).push(Date.now());
    return goed;
  };
  const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(o)); };
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const web = http.createServer(async (req, res) => {
    const ip = adresVan(req), url = new URL(req.url, 'http://x');
    if (url.pathname === '/status' && req.method === 'GET') return json(res, 200, { ok: true, versie: S.PROTOCOL, open: kamers.size, spelers: [...verbindingen.values()].filter(v => v.kamer).length });
    if (url.pathname.startsWith('/beheer/')) {
      if (!beheerOk(req, ip)) return json(res, 401, { fout: 'geen toegang' });
      if (url.pathname === '/beheer/meldingen' && req.method === 'GET') return json(res, 200, { meldingen: db.meldingen() });
      if (url.pathname === '/beheer/werelden' && req.method === 'GET') {
        const l = db.db.prepare('SELECT w.id, w.naam, w.stand, w.gemaakt, w.gespeeld, (SELECT COUNT(*) FROM stukken s WHERE s.wereld = w.id) AS stukken, (SELECT COUNT(*) FROM spelers p WHERE p.wereld = w.id) AS spelers FROM werelden w ORDER BY w.gespeeld DESC').all();
        return json(res, 200, { werelden: l.map(w => Object.assign(w, { naam: S.naamVan(JSON.parse(w.naam), 'nl'), open: kamers.has(w.id) })) });
      }
      if (url.pathname === '/beheer/wereld' && req.method === 'POST') {
        const id = Number(url.searchParams.get('id')), doe = url.searchParams.get('doe'), w = Number.isInteger(id) && db.wereld(id);
        if (!w) return json(res, 404, { fout: 'onbekende wereld' });
        const k = kamers.get(id);
        if (doe === 'dicht' || doe === 'open') {
          if (k) k.worker.postMessage({ t: 'beheer-dicht', aan: doe === 'dicht' });
          else db.zetRegels(id, Object.assign(w.regels, { dicht: doe === 'dicht' }));
          log('beheer:', doe, id); return json(res, 200, { ok: true });
        }
        if (doe === 'verwijder') {
          if (k) { for (const sid of k.sids) sluitMet(sid, 'verwijderd'); k.sids.clear(); kamers.delete(id); stoppend.set(id, k.exit); k.worker.terminate(); await k.exit; }
          db.verwijderWereld(id); log('beheer: verwijderd', id); return json(res, 200, { ok: true });
        }
        return json(res, 400, { fout: 'doe = dicht, open of verwijder' });
      }
      return json(res, 404, { fout: 'onbekend' });
    }
    if (inst.statisch && req.method === 'GET') {
      const map = path.resolve(inst.statisch), p = path.resolve(map, '.' + decodeURIComponent(url.pathname === '/' ? '/rommelblok.html' : url.pathname));
      if (p.startsWith(map + path.sep) && fs.existsSync(p) && fs.statSync(p).isFile()) {
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        return fs.createReadStream(p).pipe(res);
      }
    }
    json(res, 404, { fout: 'niet gevonden' });
  });

  // het adres van de speler: achter nginx (alleen op deze computer) staat het in X-Real-IP; het blijft in het geheugen
  function adresVan(req) {
    const r = req.socket.remoteAddress || '';
    const lokaal = r === '127.0.0.1' || r === '::1' || r === '::ffff:127.0.0.1';
    const echt = lokaal && req.headers['x-real-ip'];
    return String(echt || r).slice(0, 64);
  }

  // ---------------- WebSocket
  const wss = new WebSocketServer({ noServer: true, maxPayload: g.berichtGrootte, perMessageDeflate: false, clientTracking: false });
  web.on('upgrade', (req, sock, kop) => {
    const weiger = (code, tekst) => { sock.write(`HTTP/1.1 ${code} ${tekst}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); sock.destroy(); };
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== inst.pad) return weiger(404, 'Not Found');
    const herkomst = String(req.headers.origin || '').replace(/\/+$/, '');
    if (!inst.herkomst.includes(herkomst)) return weiger(403, 'Forbidden');
    const ip = adresVan(req);
    if ((perAdres.get(ip) || 0) >= g.perAdres) return weiger(429, 'Too Many Requests');
    wss.handleUpgrade(req, sock, kop, ws => verbonden(ws, ip));
  });

  function verbonden(ws, ip) {
    perAdres.set(ip, (perAdres.get(ip) || 0) + 1);
    const nu = Date.now();
    const v = { sid: ++volgende, ws, ip, kamer: null, hallo: false, laatste: nu, emmer: g.piek, emmerT: nu, actieEmmer: g.actiesPerSeconde * 2, actieT: nu, zinT: 0, genegeerd: [] };
    verbindingen.set(v.sid, v);
    const halloKlok = setTimeout(() => { if (!v.hallo) sluitMet(v.sid, 'geen-hallo'); }, 10e3);
    ws.on('pong', () => { v.laatste = Date.now(); });
    ws.on('message', (data, binair) => {
      v.laatste = Date.now();
      // berichten per seconde: een emmer die bijloopt; is hij leeg, dan wordt het bericht genegeerd, en wie blijft duwen moet eruit
      const t = Date.now(); v.emmer = Math.min(g.piek, v.emmer + (t - v.emmerT) / 1000 * g.perSeconde); v.emmerT = t;
      if (v.emmer < 1) { v.genegeerd.push(t); v.genegeerd = v.genegeerd.filter(x => t - x < 10e3); if (v.genegeerd.length > 40) sluitMet(v.sid, 'te-veel'); return; }
      v.emmer -= 1;
      if (binair) return;
      let m; try { m = JSON.parse(data.toString()); } catch (e) { return; }
      if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
      if (!v.hallo) { if (m.t === 'hallo') { v.hallo = true; clearTimeout(halloKlok); hallo(v, m); } return; }
      if (m.t === 'leven' || !v.kamer) return;
      if (m.t === 'actie') {
        v.actieEmmer = Math.min(g.actiesPerSeconde * 2, v.actieEmmer + (t - v.actieT) / 1000 * g.actiesPerSeconde); v.actieT = t;
        // te veel acties: de kamer zet ze terug (de pagina had ze al gedaan)
        if (v.actieEmmer < 1) { v.kamer.worker.postMessage({ t: 'bericht', sid: v.sid, m: { t: 'actie', a: m.a, teSnel: true } }); return; }
        v.actieEmmer -= 1;
      }
      if (m.t === 'zeg') { if (t - v.zinT < g.zinElke * 1000) return; v.zinT = t; }
      v.kamer.worker.postMessage({ t: 'bericht', sid: v.sid, m });
    });
    ws.on('close', () => {
      clearTimeout(halloKlok);
      verbindingen.delete(v.sid);
      const n = (perAdres.get(ip) || 1) - 1; if (n > 0) perAdres.set(ip, n); else perAdres.delete(ip);
      if (v.kamer) { v.kamer.sids.delete(v.sid); v.kamer.worker.postMessage({ t: 'weg', sid: v.sid }); v.kamer = null; }
    });
    ws.on('error', () => { /* de verbinding gaat vanzelf dicht */ });
  }

  // een geheim (van het apparaat of de eigenaar): letters, cijfers, - en _
  const geheimGoed = s => typeof s === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(s);
  const willekeurig = () => randomInt(0, 2 ** 31) / 2 ** 31;
  async function hallo(v, m) {
    const nee = reden => sluitMet(v.sid, reden);
    if (m.v !== S.PROTOCOL) return nee('versie');
    if (!geheimGoed(m.geheim)) return nee('geheim');
    const naam = S.naamKlopt(m.naam) ? m.naam : S.naamWillekeurig(willekeurig);
    const pop = G.POP.schoonPop(Array.isArray(m.pop) ? m.pop.slice(0, 20) : null);
    const taal = m.taal === 'en' ? 'en' : 'nl';
    const straal = Number.isInteger(m.straal) ? Math.max(2, Math.min(16, m.straal)) : 8;
    const speler = hash('speler', m.geheim);
    let wereld = null, nieuw = null;
    if (m.maak && typeof m.maak === 'object') {
      // een nieuwe gedeelde wereld
      const mk = m.maak;
      if (!Number.isInteger(mk.zaad) || mk.zaad < 0 || mk.zaad > 0xFFFFFFFF) return nee('vorm');
      const stand = mk.stand === 'bouwen' ? 'bouwen' : 'overleven', moeilijk = G.WEZENS.MOEILIJK[mk.moeilijk] ? mk.moeilijk : 'makkelijk';
      if (recent(nieuwPerAdres, v.ip, DAG).length >= g.wereldenPerDag) return nee('te-veel-werelden');
      if (db.aantalWerelden() >= g.wereldenTotaal) return nee('vol-server');
      const sleutel = randomBytes(24).toString('base64url');
      for (let i = 0; i < 20 && !wereld; i++) {
        const code = S.maakCode(willekeurig);
        try { const id = db.nieuweWereld({ code: hash('code', code), eigenaar: hash('eigenaar', sleutel), naam, zaad: mk.zaad, stand, moeilijk }); wereld = db.wereld(id); nieuw = { code, sleutel }; } catch (e) { /* die code bestaat al */ }
      }
      if (!wereld) return nee('fout');
      nieuwPerAdres.get(v.ip).push(Date.now());
      log('nieuwe wereld', wereld.id, stand);
    } else {
      // meedoen met een code (na te veel foute codes even niet)
      const fouten = recent(fouteCodes, v.ip, 15 * 60e3);
      if (fouten.length >= g.fouteCodes) return nee('te-veel-codes');
      const code = S.schoonCode(m.code);
      wereld = code && db.wereldVanCode(hash('code', code));
      if (!wereld) { fouten.push(Date.now()); return nee('code'); }
    }
    const k = await kamerVoor(wereld.id);
    if (!k) return nee('druk');
    if (v.ws.readyState !== 1) { if (!k.sids.size) vanKamer(k, { t: 'leeg' }); return; }
    v.kamer = k; k.sids.add(v.sid);
    const sleutel = geheimGoed(m.sleutel) ? hash('eigenaar', m.sleutel) : nieuw ? hash('eigenaar', nieuw.sleutel) : null;
    k.worker.postMessage({ t: 'erbij', sid: v.sid, hash: speler, naam, pop, taal, straal, sleutel, nieuw });
  }

  // een teken van leven: wie 60 seconden niets van zich laat horen, gaat eruit
  const levenKlok = setInterval(() => {
    const nu = Date.now();
    for (const v of verbindingen.values()) {
      if (nu - v.laatste > g.stil * 1000) { v.ws.terminate(); continue; }
      try { v.ws.ping(); } catch (e) { /* dicht */ }
    }
  }, g.levensteken * 1000);

  return {
    web, db, kamers, verbindingen,
    luister: () => new Promise(ok => web.listen(inst.poort, inst.host, () => ok(web.address()))),
    async sluit() {
      clearInterval(levenKlok); clearInterval(opruimKlok);
      for (const v of verbindingen.values()) v.ws.terminate();
      for (const k of [...kamers.values()]) stopKamer(k);
      await Promise.all([...stoppend.values()]);
      await new Promise(ok => web.close(ok));
      db.sluit();
    },
  };
}
