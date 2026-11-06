import test from 'node:test';
import assert from 'node:assert/strict';
import { REPORT_REASONS, canSubmitReport } from '../src/components/moderation/reportReasons.js';
import { nextPhotoIndex, visiblePhotoIndex } from '../src/components/spots/photoGalleryState.js';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

test('all report targets retain seven unique reasons', () => {
  for (const reasons of Object.values(REPORT_REASONS)) {
    assert.equal(reasons.length, 7);
    assert.equal(new Set(reasons).size, 7);
  }
});

test('report submission requires verification, a reason, and a usable challenge when required', () => {
  const ready = { verified: true, reason: 'wrong_info', busy: false, challengeRequired: false, challengeToken: '' };
  assert.equal(canSubmitReport(ready), true);
  assert.equal(canSubmitReport({ ...ready, verified: false }), false);
  assert.equal(canSubmitReport({ ...ready, reason: '' }), false);
  assert.equal(canSubmitReport({ ...ready, busy: true }), false);
  assert.equal(canSubmitReport({ ...ready, challengeRequired: true }), false);
  assert.equal(canSubmitReport({ ...ready, challengeRequired: true, challengeToken: 'token' }), true);
});

test('gallery counter and navigation skip failed images', () => {
  const photos = [{ url: 'one' }, { url: 'two' }, { url: 'three' }];
  const failed = new Set(['two']);
  assert.equal(visiblePhotoIndex(photos, 1, failed), 0);
  assert.equal(nextPhotoIndex(photos, 0, failed, 1), 2);
  assert.equal(nextPhotoIndex(photos, 2, failed, 1), 0);
  assert.equal(visiblePhotoIndex(photos, 0, new Set(photos.map(photo => photo.url))), -1);
});

test('report sheet stays within narrow and desktop viewports', { skip: !existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe') }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', headless: true });
  const css = readFileSync('src/components/moderation/report-dialog.css', 'utf8');
  try {
    for (const width of [320, 360, 390, 430, 1024]) {
      const page = await browser.newPage({ viewport: { width, height: 568 } });
      await page.setContent(`<style>${css}</style><div class="sf-report-dialog" style="position:fixed;inset:0;display:flex;align-items:flex-end;justify-content:center"><div class="sf-report-panel" style="width:100%;max-width:448px;overflow:auto;padding:20px;box-sizing:border-box"><h2>Report place</h2><fieldset class="sf-report-reasons">${'<label class="sf-report-reason" style="display:block;padding:12px;margin:8px 0">Reason</label>'.repeat(7)}</fieldset><textarea class="sf-report-note" style="width:100%;box-sizing:border-box"></textarea><button class="sf-report-submit">Submit report</button></div></div>`);
      const rect = await page.evaluate(() => { const box = document.querySelector('.sf-report-panel').getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; });
      assert.ok(rect.left >= -1 && rect.right <= width + 1 && rect.top >= -1 && rect.bottom <= 569, `${width}px: ${JSON.stringify(rect)}`);
      await page.close();
    }
  } finally { await browser.close(); }
});
