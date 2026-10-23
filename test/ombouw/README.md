# Het bewijs van stap 1 (de ombouw)

Deze drie tests bewijzen dat de ombouw naar `shared/`, `client/` en `site/` niets veranderde. Ze vergelijken een gebouwde pagina met de versie die toen op de site stond (`test/referentie/rommelblok-ronde3.html`):

- **`identiek_wereld.js`**: de gedeelde code. Dezelfde lijsten en functies, en alle stukken byte voor byte gelijk.
- **`identiek_pagina.js`**: de pagina. Gelijk zijn de kop, het veiligheidsbeleid, de schermen, de gedeelde blokken en hun plek, de tekst van alle code, de texturen, het licht en de 3D-vormen.
- **`schermen_vergelijk.js`**: alle schermen, op een computer en op een telefoon, pixel voor pixel.

Vanaf stap 2 veranderen namen en tekeningen bewust. Deze tests horen dus bij stap 1 (git-label `stap1`):

```bash
git checkout stap1 && npm run bouw && node test/identiek_pagina.js
```

Wat altijd moet blijven gelden, controleren `test/zelfde_wereld.js` (de wereld blijft blok voor blok gelijk; alleen wat in `VERANDERD` staat, mag anders zijn) en `test/pagina.js` (het veiligheidsbeleid en de gedeelde blokken).
