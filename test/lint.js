// alle code nalopen met eslint (namen die nergens bestaan, dubbele sleutels): node test/lint.js
// 1. het script van de gebouwde pagina (RB_UIT/rommelblok.html), precies zoals het in de browser draait
// 2. de gedeelde code in shared/ als modules, zonder browser (zo weten we dat hij ook op de server werkt)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const UIT = require('./uit'), WORTEL = path.join(__dirname, '..');
const { spelScript } = require('./oude_pagina');
fs.writeFileSync(path.join(UIT, 'lint_spel.js'), spelScript(fs.readFileSync(path.join(UIT, 'rommelblok.html'), 'utf8')));
fs.copyFileSync(path.join(WORTEL, 'eslint.config.mjs'), path.join(UIT, 'eslint.config.mjs'));
const eslint = path.join(WORTEL, 'node_modules', '.bin', 'eslint');
let uit = '';
const loop = (cwd, doel) => { try { return execFileSync(eslint, ['--quiet', ...doel], { cwd, encoding: 'utf8' }); } catch (e) { return (e.stdout || '') + (e.stderr || ''); } };
uit += loop(UIT, ['lint_spel.js']);
uit += loop(WORTEL, ['shared']);
console.log(uit.trim() || 'lint: geen fouten (pagina en shared/)');
process.exit(/error/.test(uit) ? 1 : 0);
