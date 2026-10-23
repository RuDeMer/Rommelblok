// De opslag van de spelserver: één SQLite-bestand (node:sqlite, zit in Node 22).
// werelden  de gedeelde werelden: zaadje, stand, tijd, regels, en alleen hashes van de uitnodigingscode en de eigenaar
// stukken   per stuk van 16 x 16 alleen wat anders is dan het zaadje: [plek, waarde] als getallen van 32 bits
// dingen    de inhoud van kisten en ovens
// spelers   per wereld de plek en de rugzak van een speler, onder een hash van zijn geheim
// meldingen een week bewaard, daarna weg
// IP-adressen komen hier nooit in.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const hash = (soort, tekst) => createHash('sha256').update(soort + ':' + tekst).digest('hex');
export const WEEK = 7 * 24 * 3600 * 1000;

export function openDb(pad) {
  if (pad !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(pad)), { recursive: true });
  const db = new DatabaseSync(pad);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA foreign_keys = OFF;
    CREATE TABLE IF NOT EXISTS werelden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      eigenaar TEXT NOT NULL,
      naam TEXT NOT NULL,
      zaad INTEGER NOT NULL,
      stand TEXT NOT NULL,
      moeilijk TEXT NOT NULL,
      tijd REAL NOT NULL DEFAULT 0.3,
      dag INTEGER NOT NULL DEFAULT 0,
      regels TEXT NOT NULL DEFAULT '{}',
      gemaakt INTEGER NOT NULL,
      gespeeld INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stukken (wereld INTEGER NOT NULL, cx INTEGER NOT NULL, cz INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY (wereld, cx, cz)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS dingen (wereld INTEGER NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, z INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (wereld, x, y, z)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS spelers (wereld INTEGER NOT NULL, speler TEXT NOT NULL, naam TEXT NOT NULL, pop TEXT, plek TEXT, data TEXT, gezien INTEGER NOT NULL, PRIMARY KEY (wereld, speler)) WITHOUT ROWID;
    CREATE TABLE IF NOT EXISTS meldingen (id INTEGER PRIMARY KEY AUTOINCREMENT, wereld INTEGER NOT NULL, door TEXT NOT NULL, over TEXT NOT NULL, naam TEXT NOT NULL, wat TEXT NOT NULL, tijd INTEGER NOT NULL);
  `);
  const q = sql => db.prepare(sql);
  const S = {
    wereldMaak: q('INSERT INTO werelden (code, eigenaar, naam, zaad, stand, moeilijk, tijd, dag, regels, gemaakt, gespeeld) VALUES (?, ?, ?, ?, ?, ?, 0.3, 0, ?, ?, ?)'),
    wereldCode: q('SELECT * FROM werelden WHERE code = ?'),
    wereld: q('SELECT * FROM werelden WHERE id = ?'),
    aantal: q('SELECT COUNT(*) AS n FROM werelden'),
    tijdZet: q('UPDATE werelden SET tijd = ?, dag = ?, gespeeld = ? WHERE id = ?'),
    codeZet: q('UPDATE werelden SET code = ? WHERE id = ?'),
    regelsZet: q('UPDATE werelden SET regels = ? WHERE id = ?'),
    stukken: q('SELECT cx, cz, data FROM stukken WHERE wereld = ?'),
    stukZet: q('INSERT INTO stukken (wereld, cx, cz, data) VALUES (?, ?, ?, ?) ON CONFLICT (wereld, cx, cz) DO UPDATE SET data = excluded.data'),
    dingen: q('SELECT x, y, z, data FROM dingen WHERE wereld = ?'),
    dingZet: q('INSERT INTO dingen (wereld, x, y, z, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT (wereld, x, y, z) DO UPDATE SET data = excluded.data'),
    dingWeg: q('DELETE FROM dingen WHERE wereld = ? AND x = ? AND y = ? AND z = ?'),
    speler: q('SELECT * FROM spelers WHERE wereld = ? AND speler = ?'),
    spelerZet: q('INSERT INTO spelers (wereld, speler, naam, pop, plek, data, gezien) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (wereld, speler) DO UPDATE SET naam = excluded.naam, pop = excluded.pop, plek = excluded.plek, data = COALESCE(excluded.data, spelers.data), gezien = excluded.gezien'),
    melding: q('INSERT INTO meldingen (wereld, door, over, naam, wat, tijd) VALUES (?, ?, ?, ?, ?, ?)'),
    meldingen: q('SELECT id, wereld, naam, wat, tijd FROM meldingen ORDER BY tijd DESC LIMIT 200'),
    meldingenOud: q('DELETE FROM meldingen WHERE tijd < ?'),
    weg: ['DELETE FROM stukken WHERE wereld = ?', 'DELETE FROM dingen WHERE wereld = ?', 'DELETE FROM spelers WHERE wereld = ?', 'DELETE FROM werelden WHERE id = ?'].map(q),
  };
  const regels = r => { try { const o = JSON.parse(r.regels || '{}'); return { bouwen: o.bouwen === 'eigenaar' ? 'eigenaar' : 'iedereen', dicht: !!o.dicht, geweerd: Array.isArray(o.geweerd) ? o.geweerd.slice(0, 500) : [] }; } catch (e) { return { bouwen: 'iedereen', dicht: false, geweerd: [] }; } };
  const naam = r => { try { const n = JSON.parse(r.naam); return Array.isArray(n) ? n : [0, 0]; } catch (e) { return [0, 0]; } };
  const metRegels = r => (r ? Object.assign({}, r, { regels: regels(r), naam: naam(r) }) : null);
  return {
    db,
    sluit() { try { db.close(); } catch (e) { /* al dicht */ } },
    nieuweWereld(w) {
      const nu = Date.now();
      const r = S.wereldMaak.run(w.code, w.eigenaar, JSON.stringify(w.naam), w.zaad, w.stand, w.moeilijk, JSON.stringify({ bouwen: 'iedereen', dicht: false, geweerd: [] }), nu, nu);
      return Number(r.lastInsertRowid);
    },
    wereldVanCode: code => metRegels(S.wereldCode.get(code)),
    wereld: id => metRegels(S.wereld.get(id)),
    aantalWerelden: () => S.aantal.get().n,
    bewaarTijd: (id, tijd, dag) => S.tijdZet.run(tijd, dag, Date.now(), id),
    zetCode: (id, code) => S.codeZet.run(code, id),
    zetRegels: (id, r) => S.regelsZet.run(JSON.stringify(r), id),
    // de veranderingen van alle stukken: [cx, cz, Uint32Array([plek << 16 | waarde, ...])]
    stukken: id => S.stukken.all(id).map(r => [r.cx, r.cz, new Uint32Array(r.data.buffer.slice(r.data.byteOffset, r.data.byteOffset + r.data.byteLength))]),
    bewaarStukken(id, lijst) {
      db.exec('BEGIN');
      try { for (const [cx, cz, a] of lijst) S.stukZet.run(id, cx, cz, Buffer.from(a.buffer, a.byteOffset, a.byteLength)); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    dingen: id => S.dingen.all(id).map(r => { try { return [r.x, r.y, r.z, JSON.parse(r.data)]; } catch (e) { return null; } }).filter(Boolean),
    bewaarDingen(id, lijst) {
      db.exec('BEGIN');
      try { for (const [x, y, z, d] of lijst) { if (d) S.dingZet.run(id, x, y, z, JSON.stringify(d)); else S.dingWeg.run(id, x, y, z); } db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
    speler(id, speler) {
      const r = S.speler.get(id, speler); if (!r) return null;
      const lees = t => { try { return t ? JSON.parse(t) : null; } catch (e) { return null; } };
      return { naam: lees(r.naam), pop: lees(r.pop), plek: lees(r.plek), data: lees(r.data), gezien: r.gezien };
    },
    bewaarSpeler: (id, speler, s) => S.spelerZet.run(id, speler, JSON.stringify(s.naam), s.pop ? JSON.stringify(s.pop) : null, s.plek ? JSON.stringify(s.plek) : null, s.data ? JSON.stringify(s.data) : null, Date.now()),
    melding: (wereld, door, over, naam, wat) => S.melding.run(wereld, door, over, JSON.stringify(naam), JSON.stringify(wat), Date.now()),
    meldingen: () => S.meldingen.all().map(r => ({ id: r.id, wereld: r.wereld, naam: JSON.parse(r.naam), wat: JSON.parse(r.wat), tijd: r.tijd })),
    opruimen: () => S.meldingenOud.run(Date.now() - WEEK),
    verwijderWereld(id) {
      db.exec('BEGIN');
      try { for (const s of S.weg) s.run(id); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
