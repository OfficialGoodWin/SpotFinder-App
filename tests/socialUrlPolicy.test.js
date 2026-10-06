import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { validateSocialPostUrl as validateClient } from '../src/lib/socialUrlPolicy.js';

const require = createRequire(import.meta.url);
const { validateSocialPostUrl: validateServer } = require('../functions/socialUrlPolicy.js');
const validators = [['client', validateClient], ['server', validateServer]];

const valid = [
  ['https://www.instagram.com/p/AbC_123-/', 'instagram', 'https://www.instagram.com/p/AbC_123-/'],
  ['https://www.instagram.com/reel/xyz987/', 'instagram', 'https://www.instagram.com/reel/xyz987/'],
  ['https://www.tiktok.com/@spot.finder/video/6718335390845095173', 'tiktok', 'https://www.tiktok.com/@spot.finder/video/6718335390845095173'],
  ['https://WWW.Instagram.COM/p/abc', 'instagram', 'https://www.instagram.com/p/abc/'],
];

const invalid = [
  'http://www.instagram.com/p/abc/',
  'https://evil.com/p/abc/',
  'https://instagram.com.evil.com/p/abc/',
  'https://evilinstagram.com/p/abc/',
  'javascript:alert(1)',
  'data:text/html,<h1>bad</h1>',
  'blob:https://www.instagram.com/abc',
  'file:///etc/passwd',
  'https://www.instagram.com/accounts/login/',
  'https://www.tiktok.com/login',
  'https://www.tiktok.com/@user',
  'https://www.tiktok.com/@user/video/not-a-valid-id',
  'https://user:password@www.instagram.com/p/abc/',
  'https://www.instagram.com:444/p/abc/',
  '<iframe src="https://www.instagram.com/p/abc/"></iframe>',
  '<script>alert(1)</script>',
  ' https://www.instagram.com/p/abc/',
  'https://www.instagram.com/p/abc/ ',
  'https://www.instagram.com/p/ab\u0000c/',
  'https://www.instagram.com/p/%61bc/',
  'https://www.instagram.com/p/%2561bc/',
  'https://www.instagram.com\\p\\abc',
  'https://www.instagram.com/p/abc/?utm_source=test',
  'https://www.instagram.com/p/abc/#fragment',
  'https://www.tiktok.com/@user/video/6718335390845095173?lang=en',
  'https://www.tiktok.com/@user/video/6718335390845095173#x',
  'https://instagram.com/p/abc/',
  'https://tiktok.com/@user/video/6718335390845095173',
  'not a url',
  '',
  'https://www.instagram.com/p/' + 'a'.repeat(600),
  'https://www.instagram.com/p/ümlaut/',
];

for (const [name, validate] of validators) {
  test(`${name}: accepts and canonicalizes supported URLs`, () => {
    for (const [input, provider, canonicalUrl] of valid) {
      const result = validate(input);
      assert.equal(result.ok, true, input);
      assert.equal(result.provider, provider, input);
      assert.equal(result.canonicalUrl, canonicalUrl, input);
    }
  });

  test(`${name}: rejects malformed, deceptive, and unsupported inputs`, () => {
    for (const input of invalid) assert.equal(validate(input).ok, false, input);
  });
}

test('client and server policies stay equivalent', () => {
  for (const input of [...valid.map(([url]) => url), ...invalid]) {
    assert.deepEqual(validateClient(input), validateServer(input), input);
  }
});
