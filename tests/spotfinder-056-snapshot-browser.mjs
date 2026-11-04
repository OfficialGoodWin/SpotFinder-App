import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { decodeSnapshotSpot, regionForPoint, validSnapshotSpot } from '../src/new/publicSpotSnapshotFormat.js';
import { hashSnapshotValue } from '../scripts/public-spots/export.mjs';

const origin = process.env.SPOTFINDER_STAGE_URL?.replace(/\/$/, '');
const accessUrl = process.env.VERCEL_SHARE_URL;
if (!origin || !accessUrl || !accessUrl.startsWith(origin))
  throw new Error('Exact staged origin and protected access URL required');

const approvedRevision = 'b774fb3c76a166ed9433';
const bled = { latitude: 46.36, longitude: 14.10 };
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true,
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, geolocation: bled,
  permissions: ['geolocation'] });
let firestoreRequests = 0;
let spotFallbacks = 0;
let revocationListens = 0;
const appCheckStatuses = [];
const consoleErrors = [];

await context.route('https://identitytoolkit.googleapis.com/**/accounts:signUp*', route => route.abort());
await context.route('https://firestore.googleapis.com/**', route => {
  firestoreRequests += 1;
  if (firestoreRequests > 15) return route.abort();
  let payload = route.request().postData() || '';
  try { payload = decodeURIComponent(payload); } catch { /* no payload details needed */ }
  if (/spot_snapshot_revocation_feed/.test(payload)) revocationListens += 1;
  if (/collectionId["\\:]+spots\b/.test(payload)) { spotFallbacks += 1; return route.abort(); }
  return route.continue();
});

const page = await context.newPage();
page.on('console', message => {
  if (message.type() === 'error') consoleErrors.push(message.text().replace(/https?:\/\/\S+/g, '[url]').slice(0, 120));
});
page.on('response', response => {
  if (new URL(response.url()).hostname === 'content-firebaseappcheck.googleapis.com')
    appCheckStatuses.push(response.status());
});
const getJson = async path => {
  const result = await page.evaluate(async url => {
    const response = await fetch(url, { cache: 'no-store' });
    return { status: response.status, data: response.ok ? await response.json() : null };
  }, path);
  assert.equal(result.status, 200, `${path} must return HTTP 200`);
  return result.data;
};

try {
  const startup = await page.goto(accessUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(startup?.status(), 200);
  const consent = page.getByRole('button', { name: 'Keep optional services off' });
  if (await consent.isVisible()) await consent.click();
  const explore = page.getByRole('button', { name: /Explore the map/i });
  if (await explore.count()) await explore.first().click();

  const manifest = await getJson('/spot-snapshots/manifest.json');
  assert.equal(manifest.format, 3);
  assert.equal(manifest.revision, approvedRevision);
  const key = regionForPoint(bled.latitude, bled.longitude);
  const name = manifest.regions[key];
  assert.ok(name, 'Known populated region must be referenced');
  const region = await getJson(`/spot-snapshots/v3/${name}`);
  assert.equal(hashSnapshotValue(region), name.slice(key.length + 1, -5));
  const spots = region.spots.map(decodeSnapshotSpot);
  assert.ok(spots.every(validSnapshotSpot));
  assert.ok(spots.some(spot => Math.abs(spot.lat - bled.latitude) < 0.2
    && Math.abs(spot.lng - bled.longitude) < 0.2));

  const locate = page.locator('button[aria-label*="location" i], button[aria-label*="poloha" i]').first();
  await locate.click({ timeout: 5000 });
  await page.waitForTimeout(5000);
  const originalMarkers = await page.locator('.sf-discovery-marker').count();

  const redesigned = await page.goto(`${origin}/new`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  assert.equal(redesigned?.status(), 200);
  await page.getByRole('button', { name: 'Moje poloha' }).first().click({ timeout: 5000 });
  await page.waitForTimeout(5000);
  const redesignedMarkers = await page.locator('.sf-new-map-marker').count();

  assert.equal(spotFallbacks, 0, 'CDN discovery must not query /spots');
  assert.ok(firestoreRequests <= 15, 'Unexpected Firestore request loop');
  assert.ok(revocationListens > 0, 'Live revocation feed was not requested');
  assert.ok(originalMarkers > 0, 'Original map marker missing in populated viewport');
  assert.ok(redesignedMarkers > 0, 'Redesigned map marker missing in populated viewport');
  console.log(JSON.stringify({ passed: true, manifestRevision: manifest.revision,
    originalMarkers, redesignedMarkers, firestoreRequests, revocationListens,
    appCheckStatuses, consoleErrorCount: consoleErrors.length }));
} catch (error) {
  console.log(JSON.stringify({ passed: false, reason: String(error.message || error).slice(0, 180),
    firestoreRequests, spotFallbacks, revocationListens, appCheckStatuses,
    consoleErrors: consoleErrors.slice(0, 5) }));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
