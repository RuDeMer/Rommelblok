// Een maker in een eigen draad: maakt nieuwe stukken wereld uit het zaadje (dezelfde code als op de pagina).
import { parentPort } from 'node:worker_threads';
import { G } from '../../shared/index.js';
import { RB_MAKER } from '../../client/src/werkers/werker.js';

// RB_MAKER verwacht een bericht 'poort' met de poort erbij, zoals in de browser (daar in e.ports)
let behandel = null;
RB_MAKER(G, { set onmessage(f) { behandel = f; } });
parentPort.on('message', m => { if (m && m.t === 'poort') behandel({ data: m, ports: [m.poort] }); });
