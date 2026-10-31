import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(config.rewrites.map(rule => [rule.source, rule.destination]));

const appRouteRewrites = [
  '/new', '/new/:path*',
  '/Home', '/home', '/FAQ', '/faq',
  '/Status', '/status', '/StatusAdmin', '/statusadmin',
  '/Admin', '/admin',
  '/PrivacyPolicy', '/privacypolicy',
  '/TermsAndConditions', '/termsandconditions',
  '/CookiePolicy', '/cookiepolicy',
  '/RefundPolicy', '/refundpolicy',
  '/Updates', '/updates',
];

test('clean URLs rewrite known screens to the served root document', () => {
  assert.equal(config.cleanUrls, true);
  for (const route of appRouteRewrites) {
    assert.equal(rewrites.get(route), '/', `${route} must reach React Router`);
  }
});

test('only explicit app routes rewrite to the root document', () => {
  const rootRewrites = config.rewrites
    .filter(rule => rule.destination === '/')
    .map(rule => rule.source)
    .sort();
  assert.deepEqual(rootRewrites, [...appRouteRewrites].sort());
  for (const route of ['/news', '/news/example', '/assets/missing.js', '/api/report', '/favicon.ico', '/missing.js', '/anything']) {
    assert.equal(rewrites.has(route), false, `${route} must retain filesystem/404 handling`);
  }
});

test('spot pages use the server-rendered API route', () => {
  assert.equal(rewrites.get('/spot/:spotId'), '/api/spot-page?spotId=:spotId');
  assert.equal(rewrites.get('/Spot/:spotId'), '/api/spot-page?spotId=:spotId');
});
