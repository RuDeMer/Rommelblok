// Vite: om te werken (npm run dev) en als basis voor de Tauri-app. De pagina voor de site maakt site/maak-pagina.js.
import { defineConfig } from 'vite';
import rommelblok from './rommelblok-plugin.js';
export default defineConfig({
  root: import.meta.dirname,
  plugins: [rommelblok()],
  server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
  build: { target: 'esnext', minify: false, outDir: '../dist/vite', emptyOutDir: true },
});
