import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright-core';
import { writePublicSpotSnapshot } from './export.mjs';
import { assertPublisherTarget } from './publish.mjs';

assertPublisherTarget({ mode: 'emulator', projectId: 'demo-spotfinder-snapshots',
  emulatorHost: process.env.FIRESTORE_EMULATOR_HOST });
const browserPath = process.env.SPOTFINDER_TEST_BROWSER || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);
if (!browserPath) throw new Error('No installed Chrome/Edge executable for playwright-core');
const root = await mkdtemp(join(tmpdir(), 'spotfinder-browser-snapshot-'));
const artifacts = join(root, 'spot-snapshots');
const revocationRef = getFirestore(initializeApp({ projectId: 'demo-spotfinder-local' }, 'snapshot-browser-feed'))
  .collection('spot_snapshot_revocation_feed').doc('current');
const detailRef = revocationRef.firestore.collection('spots').doc('synthetic-browser-marker');
const synthetic = { id: 'synthetic-browser-marker', lat: 50.0755, lng: 14.4378,
  title: 'Synthetic Browser Marker', is_public: true, status: 'published',
  created_date: '2026-10-30', flag_count: 0 };
let vite;
let browser;
try {
  await writePublicSpotSnapshot([synthetic], artifacts);
  await revocationRef.set({ format: 1, revoked: [] });
  await detailRef.set(synthetic);
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5187', '--strictPort'], {
    cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env,
      VITE_SPOTFINDER_STAGE: 'emulator', VITE_FIREBASE_EMULATOR_ONLY: 'true',
      VITE_PUBLIC_SPOT_SNAPSHOTS: 'true', SPOTFINDER_SNAPSHOT_FIXTURE_DIR: artifacts,
      VITE_ORIGINAL_MAP_SNAPSHOTS: 'true',
    },
  });
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (vite.exitCode !== null) throw new Error(`Vite exited with code ${vite.exitCode}`);
    try { const response = await fetch('http://127.0.0.1:5187/spot-snapshots/manifest.json'); if (response.ok) { ready = true; break; } }
    catch { /* Wait for the local server. */ }
    await delay(250);
  }
  if (!ready) throw new Error('Local Vite snapshot server did not start');
  browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const snapshotRequests = [];
  const viewportQueries = [];
  const forbidden = [];
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(error.name + ': ' + error.message.slice(0, 150)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200)); });
  page.on('request', request => {
    const url = request.url();
    if (url.includes('/spot-snapshots/')) snapshotRequests.push(url);
    if (/^https:\/\//.test(url) && /firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|firebaseapp-cdc7b/.test(url)) forbidden.push(url);
  });
  // Snapshot-backed pages must not open a Firestore spots viewport query.
  context.on('request', request => {
    const body = request.postData() || '';
    if (request.url().includes('/google.firestore.v1.Firestore/Listen/channel')
      && body.includes('structuredQuery') && body.includes('spots')) viewportQueries.push(request.url());
  });
  await page.route(/^https:\/\//, route => route.abort()); // No real analytics, tiles, or Firebase network.
  const manifestResponse = page.waitForResponse(response => response.url().endsWith('/spot-snapshots/manifest.json'));
  const initialStarted = Date.now();
  await page.goto('http://127.0.0.1:5187/new/map', { waitUntil: 'domcontentloaded' });
  try { assert.equal((await manifestResponse).status(), 200); }
  catch (error) {
    console.error(JSON.stringify({ stage: 'manifest-after-listener', pageErrors, consoleErrors,
      body: (await page.locator('body').innerText()).slice(0, 800) }));
    throw error;
  }
  try { await page.getByText('Synthetic Browser Marker').first().waitFor({ timeout: 15000 }); }
  catch (error) {
    console.error(JSON.stringify({ stage: 'initial-marker', snapshotRequests,
      pageErrors, body: (await page.locator('body').innerText()).slice(0, 800) }));
    throw error;
  }
  const initialVisibleMs = Date.now() - initialStarted;
  const original = await context.newPage();
  const originalSnapshotRequests = [];
  const originalViewportQueries = [];
  original.on('request', request => {
    if (request.url().includes('/spot-snapshots/')) originalSnapshotRequests.push(request.url());
    const body = request.postData() || '';
    if (request.url().includes('/google.firestore.v1.Firestore/Listen/channel')
      && body.includes('structuredQuery') && body.includes('spots')) originalViewportQueries.push(request.url());
  });
  await original.route(/^https:\/\//, route => route.abort());
  const originalStarted = Date.now();
  await original.goto('http://127.0.0.1:5187/', { waitUntil: 'domcontentloaded' });
  const originalMarker = original.locator('[aria-label*="Synthetic Browser Marker"]').first();
  await originalMarker.waitFor({ timeout: 15000 });
  const originalVisibleMs = Date.now() - originalStarted;
  assert.ok(originalSnapshotRequests.some(url => url.endsWith('/spot-snapshots/manifest.json')));
  assert.deepEqual(originalViewportQueries, []);
  await originalMarker.click();
  await original.waitForURL(/\/spot\/synthetic-browser-marker$/, { timeout: 15000 });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metricValue = (metrics, name) => metrics.metrics.find(item => item.name === name)?.value ?? null;
  const firstPerformance = await cdp.send('Performance.getMetrics');
  assert.deepEqual(forbidden, []);
  const initial = snapshotRequests.length;
  const canvas = page.locator('.maplibregl-canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 20, { steps: 4 });
    await page.mouse.up();
    await page.mouse.wheel(0, -150);
  }
  await page.setViewportSize({ width: 768, height: 720 });
  const warmStarted = Date.now();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Synthetic Browser Marker').first().waitFor({ timeout: 15000 });
  const warmVisibleMs = Date.now() - warmStarted;
  await writePublicSpotSnapshot([{ ...synthetic, title: 'Edited Browser Marker' }], artifacts);
  await page.reload({ waitUntil: 'domcontentloaded' });
  try { await page.getByText('Edited Browser Marker').first().waitFor({ timeout: 15000 }); }
  catch (error) {
    console.error(JSON.stringify({ stage: 'edited-marker', snapshotRequests,
      pageErrors, body: (await page.locator('body').innerText()).slice(0, 800) }));
    throw error;
  }
  const takedownStarted = Date.now();
  await writePublicSpotSnapshot([{ ...synthetic, status: 'hidden' }], artifacts);
  await page.getByText('Edited Browser Marker').first().waitFor({ state: 'detached', timeout: 40000 });
  const activeTabTakedownMs = Date.now() - takedownStarted;
  await page.route('**/spot-snapshots/manifest.json', route => route.fulfill({ status: 200,
    contentType: 'application/json', body: '{"format":999}' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Místa se nepodařilo načíst.').first().waitFor({ timeout: 15000 });
  await page.unroute('**/spot-snapshots/manifest.json');
  await writePublicSpotSnapshot([synthetic], artifacts);
  await page.route('**/spot-snapshots/*/*.json', route => route.fulfill({ status: 404, body: 'Missing' }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Místa se nepodařilo načíst.').first().waitFor({ timeout: 15000 });
  await page.unroute('**/spot-snapshots/*/*.json');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Synthetic Browser Marker').first().waitFor({ timeout: 15000 });
  await context.setOffline(true);
  await delay(5500);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.getByText('Místa se nepodařilo načíst.').first().waitFor({ timeout: 15000 });
  await context.setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Synthetic Browser Marker').first().waitFor({ timeout: 15000 });
  // Legacy format-2 artifacts must remain readable after the format-3 rollout.
  await writePublicSpotSnapshot([synthetic], artifacts, { format: 2 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Synthetic Browser Marker').first().waitFor({ timeout: 15000 });
  await writePublicSpotSnapshot([synthetic], artifacts);
  const revokedIds = [];
  const revocationTrialsMs = [];
  const revocationWriteAckMs = [];
  const revocationClientMs = [];
  let originalRevocationMs = null;
  for (let trial = 0; trial < 5; trial += 1) {
    const trialSpot = trial === 0 ? synthetic : { ...synthetic,
      id: `synthetic-trial-${trial}`, title: `Synthetic Trial ${trial}` };
    if (trial > 0) {
      await writePublicSpotSnapshot([trialSpot], artifacts);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByText(trialSpot.title).first().waitFor({ timeout: 15000 });
    }
    const secondTab = trial === 0 ? await context.newPage() : null;
    if (secondTab) {
      await secondTab.goto('http://127.0.0.1:5187/new/map', { waitUntil: 'domcontentloaded' });
      await secondTab.getByText(trialSpot.title).first().waitFor({ timeout: 15000 });
    }
    const started = Date.now();
    revokedIds.push(trialSpot.id);
    await revocationRef.set({ format: 1, revoked: revokedIds });
    const authoritativeAt = Date.now();
    await page.getByText(trialSpot.title).first().waitFor({ state: 'detached', timeout: 30000 });
    if (secondTab) {
      await secondTab.getByText(trialSpot.title).first().waitFor({ state: 'detached', timeout: 30000 });
      await secondTab.close();
    }
    if (trial === 0) {
      await originalMarker.waitFor({ state: 'detached', timeout: 30000 });
      originalRevocationMs = Date.now() - authoritativeAt;
    }
    const removedAt = Date.now();
    revocationWriteAckMs.push(authoritativeAt - started);
    revocationClientMs.push(removedAt - authoritativeAt);
    revocationTrialsMs.push(removedAt - started);
  }
  const fresh = await context.newPage();
  const freshStarted = Date.now();
  await fresh.goto('http://127.0.0.1:5187/new/map', { waitUntil: 'domcontentloaded' });
  await fresh.getByText('0 míst na mapě').first().waitFor({ timeout: 15000 });
  const freshSuppressionMs = Date.now() - freshStarted;
  assert.equal(await fresh.getByText('Synthetic Trial 4').count(), 0);
  await revocationRef.delete();
  await fresh.reload({ waitUntil: 'domcontentloaded' });
  await fresh.getByText('Místa se nepodařilo načíst. Zkusit znovu').first().waitFor({ timeout: 15000 });
  await revocationRef.set({ format: 1, revoked: revokedIds });
  await fresh.reload({ waitUntil: 'domcontentloaded' });
  await fresh.getByText('0 míst na mapě').first().waitFor({ timeout: 15000 });
  await fresh.close();
  const clusterSpots = [
    { ...synthetic, id: 'synthetic-cluster-a', title: 'Synthetic Cluster A', lat: 50.0756, lng: 14.4379 },
    { ...synthetic, id: 'synthetic-cluster-b', title: 'Synthetic Cluster B', lat: 50.0754, lng: 14.4377 },
  ];
  await writePublicSpotSnapshot(clusterSpots, artifacts);
  const clusterPage = await context.newPage();
  await clusterPage.route(/^https:\/\//, route => route.abort());
  await clusterPage.goto('http://127.0.0.1:5187/new/map', { waitUntil: 'domcontentloaded' });
  const cluster = clusterPage.locator('.sf-new-map-cluster').first();
  await cluster.waitFor({ timeout: 15000 });
  assert.match((await cluster.getAttribute('aria-label')) || '', /^2 míst poblíž/);
  await clusterPage.close();
  await original.close();
  const lastPerformance = await cdp.send('Performance.getMetrics');
  assert.deepEqual(forbidden, []);
  assert.deepEqual(viewportQueries, []);
  console.log(JSON.stringify({ passed: true, scenarios: ['initial', 'original-map-load-and-revocation', 'pan', 'zoom', 'mobile-resize', 'reload', 'edit', 'active-tab-hide', 'corrupt-manifest', 'missing-region', 'offline', 'legacy-format-2', 'active-revocation', 'new-session-revocation', 'revocation-outage-and-recovery', 'cluster-marker'],
    initialSnapshotRequests: initial, totalSnapshotRequests: snapshotRequests.length,
    initialVisibleMs, warmVisibleMs, originalVisibleMs, originalRevocationMs,
    activeTabTakedownMs, revocationTrialsMs,
    revocationWriteAckMs, revocationClientMs, freshSuppressionMs,
    firestoreSpotViewportQueries: viewportQueries.length,
    browserJsHeapStartBytes: metricValue(firstPerformance, 'JSHeapUsedSize'),
    browserJsHeapEndBytes: metricValue(lastPerformance, 'JSHeapUsedSize'),
    browserTaskDurationStartSeconds: metricValue(firstPerformance, 'TaskDuration'),
    browserTaskDurationEndSeconds: metricValue(lastPerformance, 'TaskDuration'),
    productionFirebaseRequests: forbidden.length }));
} finally {
  await browser?.close();
  if (vite) { vite.kill(); await delay(500); }
  if (!resolve(root).startsWith(resolve(tmpdir(), 'spotfinder-browser-snapshot-'))) throw new Error('Unsafe browser fixture cleanup');
  await rm(root, { recursive: true, force: true });
}
