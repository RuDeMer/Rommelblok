// Alles wat de pagina, de rekenhulpjes en de server van de gedeelde code gebruiken.
// Gedeelde code: draait op de pagina, in de rekenhulpjes en op de server (geen DOM).
// G heeft dezelfde namen (en volgorde) als wat RB_GEDEELD() vroeger teruggaf; wat er later bij kwam, staat achteraan.
import { B, BL, DEMP, DICHT, DTEXNAMEN, DTEXNR, GEWAS, HOUT, HOUT2, KLEUREN, LAAG, LICHT, MAXBLOK, PALET, STEENSOORT, TEXNAMEN, TEXNR, VAST, VERVANG, VN, VORM, W, dtex, isWater, tex } from './blokken.js';
import { CH, HOOG, SECTIES, VOL, ZEE, idx } from './maat.js';
import { OVEN, REC, ovenRecept, zoekRecept } from './recepten.js';
import { glad, mix, ruis } from './ruis.js';
import { eindHoogte, heeftEind, isSpoor, spoorEinden, spoorKies, spoorOp } from './spoor.js';
import { hsh, kans, rng, zaadVan } from './toeval.js';
import { GEREED, I, IT, KLASSE, KLEURITEM, TAG, bouwGroep, itemVan, past } from './voorwerpen.js';
import { POTPLANT, RICHTING, TEXOFS, botsDozen, kijkDozen, vormDozen } from './vormen.js';
import { BI, BIOMEN, rgb565 } from './wereld/biomen.js';
import { maakWereld } from './wereld/index.js';
// nieuw sinds de ombouw (achteraan, zodat de oude namen en hun volgorde gelijk blijven)
import * as POP from './poppetje.js';
import * as BLOKWAARDE from './blokwaarde.js';
import * as WEZENS from './wezens.js';

export {
  isSpoor, spoorEinden, spoorOp, spoorKies, eindHoogte, heeftEind, CH, HOOG, ZEE, SECTIES, VOL, idx, rng, hsh, kans, zaadVan, ruis, glad, mix, RICHTING, vormDozen, botsDozen, kijkDozen, TEXOFS, BL, B, IT, I, TEXNAMEN, TEXNR, tex, DTEXNAMEN, DTEXNR, dtex, DICHT, DEMP, LICHT, VAST, LAAG, VORM, VN, VERVANG, W, isWater, MAXBLOK, HOUT, KLEUREN, KLASSE, GEREED, STEENSOORT, TAG, past, REC, OVEN, zoekRecept, ovenRecept, bouwGroep, PALET, KLEURITEM, itemVan, HOUT2, GEWAS, POTPLANT, BIOMEN, BI, maakWereld, rgb565,
  POP, BLOKWAARDE, WEZENS,
};

export const G = {
  isSpoor, spoorEinden, spoorOp, spoorKies, eindHoogte, heeftEind, CH, HOOG, ZEE, SECTIES, VOL, idx, rng, hsh, kans, zaadVan, ruis, glad, mix, RICHTING, vormDozen, botsDozen, kijkDozen, TEXOFS, BL, B, IT, I, TEXNAMEN, TEXNR, tex, DTEXNAMEN, DTEXNR, dtex, DICHT, DEMP, LICHT, VAST, LAAG, VORM, VN, VERVANG, W, isWater, MAXBLOK, HOUT, KLEUREN, KLASSE, GEREED, STEENSOORT, TAG, past, REC, OVEN, zoekRecept, ovenRecept, bouwGroep, PALET, KLEURITEM, itemVan, HOUT2, GEWAS, POTPLANT, BIOMEN, BI, maakWereld, rgb565,
  POP, BLOKWAARDE, WEZENS,
};

export function maakGedeeld() { return G; }
