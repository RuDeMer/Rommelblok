// De wereldmaker: maakWereld(zaad, opt) geeft een wereld waarmee je stukken maakt. Voor hetzelfde zaadje altijd precies dezelfde wereld.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
import { ruis } from '../ruis.js';
import { hsh } from '../toeval.js';
import { landschap } from './landschap.js';
import { bomen } from './bomen.js';
import { grotten } from './grotten.js';
import { ertsen } from './ertsen.js';
import { bouwGrond } from './bouwgrond.js';
import { dorpen } from './dorpen.js';
import { bouwwerken } from './bouwwerken.js';
import { stuk } from './stuk.js';

export function maakWereld(zaad, opt) {
  zaad = zaad >>> 0; opt = opt || {};
  const nr = i => ruis(hsh(zaad, i, 7177, 1999));
  const nCont = nr(1), nEro = nr(2), nPiek = nr(3), nTemp = nr(4), nVocht = nr(5), nRiv = nr(6), nWx = nr(7), nWz = nr(8), nHeuvel = nr(9), nDetail = nr(10);
  const nKlif = nr(11), nSeizoen = nr(12), nBloem = nr(13), nG1 = nr(14), nG2 = nr(15), nG3 = nr(16), nG4 = nr(17), nG5 = nr(18), nIngang = nr(19), nAq = nr(20), nBerg3 = nr(21), nVlek = nr(22), nDiep = nr(23), nBodem = nr(24);
  const wm = { zaad, opt, nr, nCont, nEro, nPiek, nTemp, nVocht, nRiv, nWx, nWz, nHeuvel, nDetail, nKlif, nSeizoen, nBloem, nG1, nG2, nG3, nG4, nG5, nIngang, nAq, nBerg3, nVlek, nDiep, nBodem };
  landschap(wm);
  bomen(wm);
  grotten(wm);
  ertsen(wm);
  bouwGrond(wm);
  dorpen(wm);
  bouwwerken(wm);
  stuk(wm);
  const { kolom, maakStuk, startPlek, zetBoom, kleuren, gebied, graafGrotten, bouwVak, dorpVan, dorpBij } = wm;
  return { zaad, kolom, maakStuk, startPlek, zetBoom, kleuren, gebied, graafGrotten, bouwVak, dorpVan, dorpBij };
}
