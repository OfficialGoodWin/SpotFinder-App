// Run against a Vercel preview deployment before promoting it:
//   $env:SPOTFINDER_AUDIT_URL = 'https://...'; node scripts/deployment-hotfix-audit.mjs
const origin = process.env.SPOTFINDER_AUDIT_URL;
if (!origin || !/^https:\/\//.test(origin)) {
  throw new Error('Set SPOTFINDER_AUDIT_URL to an HTTPS Vercel preview URL.');
}
const base = origin.replace(/\/$/, '');
const failures = [];
const request = path => fetch(`${base}${path}`, { cache: 'no-store', redirect: 'manual' });
const check = (condition, detail) => { if (!condition) failures.push(detail); };

const home = await request('/');
const html = await home.text();
check(home.ok && /text\/html/i.test(home.headers.get('content-type') || ''), '/ must return HTML');
check(/no-cache|max-age=0/i.test(home.headers.get('cache-control') || ''), '/ must revalidate');
const jsPath = html.match(/src="(\/assets\/[^" ]+\.js)"/)?.[1];
const cssPath = html.match(/href="(\/assets\/[^" ]+\.css)"/)?.[1];
check(Boolean(jsPath && cssPath), 'index.html must reference hashed JS and CSS');

if (jsPath) {
  const js = await request(jsPath);
  check(js.ok && /(?:java|ecma)script/i.test(js.headers.get('content-type') || ''), `${jsPath} must return JavaScript`);
  check(/immutable/.test(js.headers.get('cache-control') || ''), `${jsPath} must be immutable`);
}
if (cssPath) {
  const css = await request(cssPath);
  check(css.ok && /text\/css/i.test(css.headers.get('content-type') || ''), `${cssPath} must return CSS`);
}

const missing = await request(`/assets/SettingsModal-hotfix-missing-${Date.now()}.js`);
check(missing.status === 404, `missing JS must be 404, got ${missing.status}`);
check(!/<div id=["']root["']><\/div>/.test(await missing.text()), 'missing JS must not return the application shell');

for (const route of ['/FAQ', '/updates', '/spot/hotfix-check']) {
  const response = await request(route);
  check(response.ok && /text\/html/i.test(response.headers.get('content-type') || ''), `${route} must load the SPA shell`);
  check(/no-cache|max-age=0/i.test(response.headers.get('cache-control') || ''), `${route} must revalidate`);
}
for (const file of ['/sw.js', '/manifest.json']) {
  const response = await request(file);
  check(response.ok && /no-cache|max-age=0/i.test(response.headers.get('cache-control') || ''), `${file} must revalidate`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Vercel preview asset, MIME, cache, missing-chunk, service-worker, and deep-link checks passed.');
}
