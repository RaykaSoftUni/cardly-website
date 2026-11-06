import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { preview } from 'vite';
import { pages } from '../src/pages/entries.js';
import './verify-dist.js';

const server = await preview({ preview: { host: '127.0.0.1', port: 4173, strictPort: true, open: false } });
const origin = 'http://127.0.0.1:4173';

async function check(url, file, contentType) {
  const response = await fetch(new URL(url, origin));
  assert.equal(response.status, 200, url);
  assert.match(response.headers.get('content-type') ?? '', contentType, url);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(`../dist/${file}`, import.meta.url)), url);
}

try {
  for (const page of pages) {
    await check(page.url, page.html, /text\/html/);
    await check(`/${page.html}`, page.html, /text\/html/);
    await check(`${page.url}?id=123`, page.html, /text\/html/);
  }
  const assets = await readdir(new URL('../dist/assets/', import.meta.url));
  for (const file of assets) {
    await check(`/assets/${file}`, `assets/${file}`, file.endsWith('.css') ? /text\/css/ : file.endsWith('.js') ? /javascript/ : /font|octet-stream/);
  }
  const missing = await fetch(`${origin}/missing-page/`);
  assert.equal(missing.status, 404, 'Unknown pages must not fall back to the homepage');
  console.log(`Production preview: ${pages.length} routes, explicit HTML URLs, query strings, ${assets.length} assets, and 404 behavior passed.`);
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
