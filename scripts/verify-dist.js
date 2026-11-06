import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages/entries.js';

export async function verifyDist() {
  for (const page of pages) {
    const html = await readFile(new URL(`../dist/${page.html}`, import.meta.url), 'utf8');
    const source = await readFile(new URL(`../pages/${page.html}`, import.meta.url), 'utf8');
    assert.equal(html.match(/<title>(.*?)<\/title>/s)?.[1], source.match(/<title>(.*?)<\/title>/s)?.[1], page.html);
    assert.match(html, /<script\b[^>]*type="module"[^>]*src="\/assets\//, page.html);
    assert.match(html, /<h1>.+<\/h1>/, page.html);
    assert.ok(!html.includes('/src/pages/'), `${page.html} still references source modules`);
  }
  console.log(`Verified all ${pages.length} HTML entries in dist.`);
}

await verifyDist();
