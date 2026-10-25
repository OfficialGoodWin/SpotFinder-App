import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { chromium } from 'playwright-core';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isJpegBytes } = require('../functions/imageFilePolicy.js');
const browserPath = process.env.SPOTFINDER_BROWSER || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('desktop and iPhone-sized browsers preview, resize, crop, and reject corrupt photos', {
  skip: !existsSync(browserPath), timeout: 90_000,
}, async () => {
  const server = await createServer({ configFile: false, plugins: [react()], resolve: { alias: { '@': resolve('src') } }, server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
      const html = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css"></head><body><script type="module">import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;</script></body></html>';
      await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto(`${origin}/`, { waitUntil: 'load' });
      const checked = await page.evaluate(async () => {
        const image = await import('/src/lib/imagePreparation.js');
        const contribution = await import('/src/lib/prepareContributionPhoto.js');
        const validation = await import('/src/lib/imageUploadValidation.js');
        const drafts = await import('/src/lib/guestDraftPhotos.js');
        const fixture = async (width, height, name = 'photo.jpg') => {
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const context = canvas.getContext('2d');
          context.fillStyle = '#c55938'; context.fillRect(0, 0, width / 2, height);
          context.fillStyle = '#2879a5'; context.fillRect(width / 2, 0, width / 2, height);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          canvas.width = canvas.height = 0;
          return new File([blob], name, { type: 'image/jpeg' });
        };
        const normal = await fixture(1200, 800);
        const large = await fixture(5000, 3000);
        const panorama = await fixture(11000, 500, 'panorama.jpg');
        const portrait = await fixture(900, 1800);
        const landscape = await fixture(600, 300);
        const landscapeBytes = new Uint8Array(await landscape.arrayBuffer());
        const orientation6 = Uint8Array.from([0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0]);
        const rotated = new File([landscapeBytes.slice(0, 2), orientation6, landscapeBytes.slice(2)], 'rotated.jpg', { type: 'image/jpeg' });
        const normalInfo = await image.inspectImageFile(normal);
        const largeInfo = await image.inspectImageFile(large);
        const panoInfo = await image.inspectImageFile(panorama);
        const portraitInfo = await image.inspectImageFile(portrait);
        const full = await image.prepareImageFile(normal, { info: normalInfo, mode: 'full' });
        const resized = await image.prepareImageFile(large, { info: largeInfo, mode: 'resize', maxEdge: 3072 });
        const wide = await image.prepareImageFile(panorama, { info: panoInfo, mode: 'resize', maxEdge: 4096 });
        const selectedNormal = await contribution.prepareContributionPhoto(normal);
        const selectedWide = await contribution.prepareContributionPhoto(panorama);
        const crop = await image.prepareImageFile(panorama, { info: panoInfo, mode: 'crop', maxEdge: 2048, crop: { x: 0.5, y: 0, width: 0.5, height: 1 } });
        const upright = await image.prepareImageFile(portrait, { info: portraitInfo, mode: 'full' });
        const oriented = await image.prepareImageFile(rotated, { mode: 'full' });
        const corrupt = new File([Uint8Array.from([1, 2, 3, 4])], 'broken.jpg', { type: 'image/jpeg' });
        let corruptMessage = '';
        try { await image.inspectImageFile(corrupt); } catch (error) { corruptMessage = error.message; }
        const heic = new File([Uint8Array.from([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99, 0, 0, 0, 0])], 'iphone.heic', { type: 'image/heic' });
        let heicMessage = '';
        try { await image.inspectImageFile(heic); } catch (error) { heicMessage = error.message; }
        window.__photoFixture = panorama;
        const [draftRef] = await drafts.persistGuestDraftPhotos('image-test-owner', 'image-test-draft', [wide.file]);
        const restored = await drafts.loadGuestDraftPhoto(draftRef, 'image-test-owner');
        await drafts.deleteGuestDraftPhotos('image-test-owner', 'image-test-draft');
        const bytes = Array.from(new Uint8Array(await wide.file.arrayBuffer()));
        return { normalInfo, largeInfo, panoInfo, portraitInfo, full: { width: full.width, height: full.height, bytes: full.bytes }, resized: { width: resized.width, height: resized.height, bytes: resized.bytes }, wide: { width: wide.width, height: wide.height, bytes: wide.bytes }, selectedNormal: { width: selectedNormal.width, height: selectedNormal.height, type: selectedNormal.file.type }, selectedWide: { width: selectedWide.width, height: selectedWide.height, type: selectedWide.file.type }, crop: { width: crop.width, height: crop.height, bytes: crop.bytes }, upright: { width: upright.width, height: upright.height }, oriented: { width: oriented.width, height: oriented.height }, corruptMessage, heicMessage, type: validation.detectImageType(new Uint8Array(await wide.file.slice(0, 16).arrayBuffer())), draft: { size: restored.size, type: restored.type }, bytes };
      });
      assert.equal(checked.panoInfo.width, 11000);
      assert.equal(checked.panoInfo.height, 500);
      assert.equal(checked.panoInfo.needsPreparation, true);
      assert.deepEqual([checked.full.width, checked.full.height], [1200, 800]);
      assert.equal(checked.resized.width, 3072);
      assert.equal(checked.wide.width, 4096);
      assert.deepEqual(checked.selectedNormal, { width: 1200, height: 800, type: 'image/jpeg' });
      assert.equal(checked.selectedWide.width, 4096);
      assert.ok(checked.selectedWide.width / checked.selectedWide.height > 20);
      assert.ok(checked.wide.width / checked.wide.height > 20);
      assert.ok(checked.crop.width > checked.crop.height);
      assert.deepEqual([checked.upright.width, checked.upright.height], [900, 1800]);
      assert.deepEqual([checked.oriented.width, checked.oriented.height], [300, 600]);
      assert.ok(checked.wide.bytes <= 5 * 1024 * 1024);
      assert.equal(checked.type, 'image/jpeg');
      assert.deepEqual(checked.draft, { size: checked.wide.bytes, type: 'image/jpeg' });
      assert.match(checked.corruptMessage, /contents do not match/);
      assert.match(checked.heicMessage, /cannot open this HEIC photo/);
      assert.equal(isJpegBytes(Buffer.from(checked.bytes)), true);

      await page.evaluate(async () => {
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const dom = await import('/node_modules/.vite/deps/react-dom_client.js');
        const { LanguageProvider } = await import('/src/lib/LanguageContext.jsx');
        const { default: Dialog } = await import('/src/components/spots/ImagePreparationDialog.jsx');
        const mount = document.createElement('div'); document.body.append(mount);
        window.__prepared = null;
        (dom.createRoot || dom.default.createRoot)(mount).render(React.createElement(LanguageProvider, null,
          React.createElement(Dialog, { file: window.__photoFixture, onConfirm: file => { window.__prepared = file; }, onCancel: () => {} })));
      });
      const dialog = page.getByRole('dialog', { name: 'Prepare photo' });
      await dialog.getByText('Resize, preserving proportions').waitFor();
      assert.equal(await dialog.getByRole('radio', { name: /Keep full image/ }).isDisabled(), true);
      await dialog.getByText('Crop selected area').click();
      await dialog.getByRole('slider', { name: /Width/ }).fill('50');
      await dialog.getByRole('slider', { name: /Left/ }).fill('50');
      await dialog.getByRole('button', { name: 'Preview result' }).click();
      await dialog.getByText(/Ready: /).waitFor();
      await dialog.getByRole('button', { name: 'Use photo' }).click();
      assert.equal(await page.evaluate(() => window.__prepared?.type), 'image/jpeg');
      const box = await dialog.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= (mobile ? 390 : 1280), `mobile=${mobile} box=${JSON.stringify(box)}`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); await server.close(); }
});
