import { defineConfig } from 'vite';
export default defineConfig({
  root: 'static/app',
  base: './',
  build: { outDir: '../../dist/ui', emptyOutDir: true },
});
