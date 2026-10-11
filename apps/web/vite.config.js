import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/Elemental/',
  build: { outDir: '../../dist', emptyOutDir: true, target: 'es2022' },
});
