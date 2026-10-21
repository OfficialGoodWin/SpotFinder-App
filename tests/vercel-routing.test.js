import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const spa = config.rewrites.find(rule => rule.destination === '/');

test('clean URL SPA fallback targets the served root document', () => {
  assert.equal(config.cleanUrls, true);
  assert.ok(spa, 'SPA fallback must rewrite to / when cleanUrls is enabled');
  assert.notEqual(spa.destination, '/index.html');
});

test('SPA fallback matches routes without catching Journal, APIs, or missing assets', () => {
  const match = new RegExp(`^${spa.source}$`);
  for (const route of ['/FAQ', '/faq', '/StatusAdmin', '/updates', '/spot/real-id', '/anything']) {
    assert.equal(match.test(route), true, `${route} must reach React Router`);
  }
  for (const route of ['/news', '/news/example', '/assets/missing.js', '/api/report', '/favicon.ico', '/missing.js']) {
    assert.equal(match.test(route), false, `${route} must retain filesystem/404 handling`);
  }
});
