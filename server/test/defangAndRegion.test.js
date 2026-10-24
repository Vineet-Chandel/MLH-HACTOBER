import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defang, defangText } from '../../shared/defang.js';
import { getStaticGuidance } from '../src/services/staticGuidance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('DEFANG: comprehensive URL and scheme defanging with idempotency', () => {
  // 1. https://evil.com/a -> hxxps://evil[.]com/a
  assert.equal(defang('https://evil.com/a'), 'hxxps://evil[.]com/a');
  assert.equal(defang(defang('https://evil.com/a')), 'hxxps://evil[.]com/a');

  // 2. http://192.168.1.1/x -> hxxp://192[.]168[.]1[.]1/x
  assert.equal(defang('http://192.168.1.1/x'), 'hxxp://192[.]168[.]1[.]1/x');
  assert.equal(defang(defang('http://192.168.1.1/x')), 'hxxp://192[.]168[.]1[.]1/x');

  // 3. https://bank.com@evil.com -> hxxps://bank[.]com[@]evil[.]com
  assert.equal(defang('https://bank.com@evil.com'), 'hxxps://bank[.]com[@]evil[.]com');
  assert.equal(defang(defang('https://bank.com@evil.com')), 'hxxps://bank[.]com[@]evil[.]com');

  // 4. hxxps://already[.]defanged/x -> idempotent
  assert.equal(defang('hxxps://already[.]defanged/x'), 'hxxps://already[.]defanged/x');
  assert.equal(defang(defang('hxxps://already[.]defanged/x')), 'hxxps://already[.]defanged/x');

  // 5. Mixed-case HTTPS -> hxxps://evil[.]com
  assert.equal(defang('HtTps://evil.com'), 'hxxps://evil[.]com');
  assert.equal(defang('HTTP://evil.com'), 'hxxp://evil[.]com');

  // 6. Scheme-less "evil.com/login" -> evil[.]com/login
  assert.equal(defang('evil.com/login'), 'evil[.]com/login');
  assert.equal(defang(defang('evil.com/login')), 'evil[.]com/login');

  // 7. Trailing punctuation: evil.com/login. and https://evil.com/a.
  assert.equal(defang('https://evil.com/a.'), 'hxxps://evil[.]com/a.');
  assert.equal(defang('evil.com/login.'), 'evil[.]com/login.');
  assert.equal(defang(defang('https://evil.com/a.')), 'hxxps://evil[.]com/a.');

  // 8. Unicode/punycode hosts
  assert.equal(
    defang('https://xn--e1afmkfd.xn--p1ai/path'),
    'hxxps://xn--e1afmkfd[.]xn--p1ai/path'
  );
  assert.equal(
    defang('https://böck.com/path'),
    'hxxps://böck[.]com/path'
  );

  // 9. Empty string & garbage
  assert.equal(defang(''), '');
  assert.equal(defang(null), '');
  assert.equal(defang(undefined), '');

  // 10. Non-URL text unchanged
  assert.equal(defang('hello world'), 'hello world');
  assert.equal(defang('this is a benign alert message.'), 'this is a benign alert message.');

  // 11. Specific user scenario: https://sbi.co.in.verify-x.com/login
  assert.equal(
    defang('https://sbi.co.in.verify-x.com/login'),
    'hxxps://sbi[.]co[.]in[.]verify-x[.]com/login'
  );

  // 12. Adversarial 100,000-char input finishes under 100 ms
  const longInput = 'https://evil.com/' + 'a'.repeat(100000);
  const start = performance.now();
  const defangedLong = defang(longInput);
  const elapsed = performance.now() - start;

  assert.ok(defangedLong.startsWith('hxxps://evil[.]com/'));
  assert.ok(elapsed < 100, `Adversarial test took ${elapsed.toFixed(2)}ms, exceeding 100ms threshold.`);
});

test('DEFANGTEXT: keeps surrounding paragraph and text completely intact', () => {
  const paragraph =
    'URGENT: Verify your account at https://evil.com/login or fallback to 192.168.1.1/x immediately. Also check bank.com/portal for help.';
  const expected =
    'URGENT: Verify your account at hxxps://evil[.]com/login or fallback to 192[.]168[.]1[.]1/x immediately. Also check bank[.]com/portal for help.';

  const result = defangText(paragraph);
  assert.equal(result, expected);

  // Idempotency check on paragraph
  assert.equal(defangText(result), expected);

  // Non-URL paragraph unchanged
  const plainText = 'Your appointment is confirmed for tomorrow at 3 PM. No action needed.';
  assert.equal(defangText(plainText), plainText);
});

test('REGION DATA: exact allowlist assertion and valid structure', () => {
  const filePath = path.resolve(__dirname, '../src/data/regions/in.json');
  assert.ok(fs.existsSync(filePath), 'server/src/data/regions/in.json must exist');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);

  assert.equal(data.region, 'IN');
  assert.equal(data.label, 'India');

  // Resources validation
  assert.ok(Array.isArray(data.resources));
  assert.equal(data.resources.length, 5, 'Must have exactly 5 resources: ncrp, helpline_1930, bank, local_cyber_cell, sanchar_saathi');

  const ids = data.resources.map((r) => r.id);
  assert.deepEqual(ids, ['ncrp', 'helpline_1930', 'bank', 'local_cyber_cell', 'sanchar_saathi']);

  // Exact allowlist assertions:
  // Hosts: cybercrime.gov.in, sancharsaathi.gov.in ONLY
  // Phones: 1930 ONLY
  const ALLOWED_HOSTS = new Set(['cybercrime.gov.in', 'sancharsaathi.gov.in']);
  const ALLOWED_PHONES = new Set(['1930']);

  for (const res of data.resources) {
    if (res.url) {
      const parsedUrl = new URL(res.url);
      assert.ok(
        ALLOWED_HOSTS.has(parsedUrl.hostname),
        `Forbidden external host in region data: ${parsedUrl.hostname}`
      );
    }
    if (res.number) {
      assert.ok(
        ALLOWED_PHONES.has(res.number),
        `Forbidden phone number in region data: ${res.number}`
      );
    }
    assert.ok(res.name_en, `Resource ${res.id} missing name_en`);
    assert.ok(res.name_hi, `Resource ${res.id} missing name_hi`);
    assert.ok(res.use_for_en, `Resource ${res.id} missing use_for_en`);
    assert.ok(res.use_for_hi, `Resource ${res.id} missing use_for_hi`);
  }
});

test('STATIC GUIDANCE BUILDER: matches file and is independent of analysis', () => {
  const guidance = getStaticGuidance('IN');

  assert.equal(guidance.source, 'static_not_ai');
  assert.equal(guidance.region, 'IN');
  assert.equal(guidance.resources.length, 5);

  // Independent of any external inputs or mock analysis
  const guidance2 = getStaticGuidance('IN');
  assert.deepEqual(guidance, guidance2);
});
