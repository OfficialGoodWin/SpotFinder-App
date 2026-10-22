import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSpotPageHandler } from '../api/spot-page.js';
import { getSpotPageFixture } from './spot-page-fixtures.js';

const shell = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const handler = createSpotPageHandler({ lookup: getSpotPageFixture, readShell: async () => shell });

async function request(id, method = 'GET') {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(body = '') { this.body = body; } };
  await handler({ method, url: `/api/spot-page?spotId=${encodeURIComponent(id)}`, query: { spotId: id } }, response);
  return response;
}

test('public spot HTML has distinct metadata and no-JS content', async () => {
  const castle = await request('AIyFTk1eTE7gD5INyomX');
  const tower = await request('K20qivFHwrGzBgBoYZW2');
  assert.equal(castle.statusCode, 200);
  assert.equal(tower.statusCode, 200);
  assert.match(castle.body, /<title>Blejski grad \| SpotFinder<\/title>/);
  assert.match(castle.body, /https:\/\/www\.spotfinder\.live\/spot\/AIyFTk1eTE7gD5INyomX/);
  assert.match(tower.body, /<title>Hlavatice \| SpotFinder<\/title>/);
  assert.match(tower.body, /<main><h1>Hlavatice<\/h1>/);
  assert.doesNotMatch(tower.body, /Blejski grad/);
});

test('missing, draft, hidden and invalid spots return 404', async () => {
  for (const id of ['missingFixture', 'draftFixture', 'hiddenFixture', 'bad.id']) {
    const response = await request(id);
    assert.equal(response.statusCode, 404, id);
    assert.doesNotMatch(response.body, /Hidden fixture|Draft fixture/);
  }
});

test('pending trust remains guest accessible but is not indexed', async () => {
  const response = await request('pendingFixture');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(response.body, /application\/ld\+json/);
});

test('sensitive public spot omits coordinates and indexing', async () => {
  const response = await request('sensitiveFixture');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /name="robots" content="noindex,follow"/);
  assert.doesNotMatch(response.body, /GeoCoordinates/);
});

test('untrusted text is escaped in HTML and structured data', async () => {
  const response = await request('specialFixture');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /&lt;example&gt; &amp; &quot;quoted text&quot;/);
  assert.doesNotMatch(response.body, /<example>/);
  assert.match(response.body, /\\u003c/);
});

test('social image uses the public gallery and excludes private photos', async () => {
  const response = await request('photoFixture');
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /og:image" content="https:\/\/example\.test\/public\.jpg"/);
  assert.doesNotMatch(response.body, /private\.jpg/);
});

test('backend failure is 503 and is never cached as missing', async () => {
  const originalError = console.error;
  console.error = () => {};
  try {
    const response = await request('failureFixture');
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  } finally { console.error = originalError; }
});

test('HEAD returns headers without a body', async () => {
  const response = await request('AIyFTk1eTE7gD5INyomX', 'HEAD');
  assert.equal(response.statusCode, 200);
  assert.equal(response.body, '');
});

test('Vercel routes known screens without a catch-all rewrite', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const rewrites = new Map(config.rewrites.map(item => [item.source, item.destination]));
  assert.equal(rewrites.get('/spot/:spotId'), '/api/spot-page?spotId=:spotId');
  for (const route of ['/Home', '/FAQ', '/Status', '/StatusAdmin', '/Admin', '/PrivacyPolicy', '/TermsAndConditions', '/CookiePolicy', '/RefundPolicy', '/updates']) {
    assert.equal(rewrites.get(route), '/', route);
  }
  assert.ok(!config.rewrites.some(item => item.destination === '/' && item.source.includes('(?!')));
});
