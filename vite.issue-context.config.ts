import { defineConfig } from 'vite';
export default defineConfig({
  root: 'static/issue-context',
  base: './',
  build: { outDir: '../../dist/issue-ui', emptyOutDir: true },
});
