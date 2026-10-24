// eslint voor Rommelblok. node test/lint.js draait dit op:
//   lint_spel.js: het hele script van de gebouwde pagina (precies wat in de browser draait), als gewoon script
//   shared/: de gedeelde code, als modules (die moet ook in Node en op de server werken, dus zonder DOM)
//   server/: de spelserver (Node)
const BROWSER = { window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', sessionStorage: 'readonly', indexedDB: 'readonly', IDBKeyRange: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', console: 'readonly', URL: 'readonly', Blob: 'readonly', Worker: 'readonly', MessageChannel: 'readonly', addEventListener: 'readonly', matchMedia: 'readonly', screen: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly', location: 'readonly', KeyboardEvent: 'readonly', CompressionStream: 'readonly', DecompressionStream: 'readonly', Response: 'readonly', btoa: 'readonly', atob: 'readonly', self: 'readonly', AudioContext: 'readonly', OfflineAudioContext: 'readonly', webkitAudioContext: 'readonly', AudioBuffer: 'readonly', DOMException: 'readonly', devicePixelRatio: 'readonly', URLSearchParams: 'readonly', WebSocket: 'readonly', crypto: 'readonly', queueMicrotask: 'readonly', fetch: 'readonly', TextDecoder: 'readonly' };
// de spelserver (server/): Node
const NODE = { process: 'readonly', Buffer: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', URL: 'readonly', fetch: 'readonly', performance: 'readonly', MessageChannel: 'readonly' };
const REGELS = { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }], 'no-dupe-keys': 'error', 'no-redeclare': 'error', 'no-unreachable': 'warn', 'no-self-assign': 'warn', 'no-constant-condition': ['warn', { checkLoops: false }] };
export default [
  { files: ['lint_spel.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: BROWSER }, rules: REGELS },
  { files: ['shared/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { console: 'readonly' } }, rules: REGELS },
  { files: ['server/**/*.js'], ignores: ['server/node_modules/**'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: NODE }, rules: REGELS },
];
