import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { pages } from './src/pages/entries.js';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const pagesRoot = fileURLToPath(new URL('./pages/', import.meta.url));

export default defineConfig({
  root: pagesRoot,
  publicDir: fileURLToPath(new URL('./public/', import.meta.url)),
  envDir: projectRoot,
  appType: 'mpa',
  resolve: {
    alias: { '/src': fileURLToPath(new URL('./src/', import.meta.url)) },
  },
  server: {
    fs: { allow: [projectRoot] },
  },
  build: {
    outDir: fileURLToPath(new URL('./dist/', import.meta.url)),
    // dist is generated output, outside the HTML source root.
    emptyOutDir: true,
    rolldownOptions: {
      input: Object.fromEntries(pages.map((page) => [
        page.id,
        fileURLToPath(new URL(page.html, new URL('./pages/', import.meta.url))),
      ])),
    },
  },
});
