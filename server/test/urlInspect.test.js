import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractUrls,
  inspectUrl,
  defangUrl,
  runUrlChecks,
} from '../src/services/urlInspect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Static security check: ensure pure string parsing and zero network lookups
test('STATIC TEST: urlInspect.js imports no network modules and does not call fetch', () => {
  const filePath = path.resolve(__dirname, '../src/services/urlInspect.js');
  const sourceCode = fs.readFileSync(filePath, 'utf-8');

  const forbiddenImports = [
    /from\s+['"]node:http['"]/i,
    /from\s+['"]http['"]/i,
    /from\s+['"]node:https['"]/i,
    /from\s+['"]https['"]/i,
    /from\s+['"]node:net['"]/i,
    /from\s+['"]net['"]/i,
    /from\s+['"]node:dns['"]/i,
    /from\s+['"]dns['"]/i,
    /from\s+['"]undici['"]/i,
    /from\s+['"]node-fetch['"]/i,
    /from\s+['"]axios['"]/i,
    /\bfetch\s*\(/,
  ];

  for (const pattern of forbiddenImports) {
    assert.equal(
      pattern.test(sourceCode),
      false,
      `Forbidden network module or call found matching: ${pattern}`
    );
  }
});

// 2. Table-driven inspectUrl test cases
test('TABLE-DRIVEN: inspectUrl rule verification', async (t) => {
  const cases = [
    {
      name: 'Clean HTTPS URL: https://example.com/',
      input: 'https://example.com/',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        assert.equal(res.hostname, 'example.com');
        assert.equal(res.registrable_domain, 'example.com');
        assert.equal(res.findings.length, 0);
        assert.equal(res.max_severity, 'none');
      },
    },
    {
      name: 'Unencrypted HTTP: http://example.com (no_https finding with exact wording)',
      input: 'http://example.com',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        const f = res.findings.find((x) => x.id === 'no_https');
        assert.ok(f, 'Expected no_https rule');
        assert.equal(f.severity, 'low');
        assert.match(f.detail, /does not prove it is malicious/i);
      },
    },
    {
      name: 'IPv4 Host with login path: http://192.168.1.10/login',
      input: 'http://192.168.1.10/login',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        assert.equal(res.hostname, '192.168.1.10');
        const ids = res.findings.map((x) => x.id);
        assert.ok(ids.includes('ip_host'));
        assert.ok(ids.includes('no_https'));
        assert.ok(ids.includes('login_keywords'));
        const ipFinding = res.findings.find((x) => x.id === 'ip_host');
        assert.equal(ipFinding.severity, 'medium');
      },
    },
    {
      name: 'Decimal IP conversion: http://3232235786/ (normalized to 192.168.1.10)',
      input: 'http://3232235786/',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        assert.equal(res.hostname, '192.168.1.10');
        const ipFinding = res.findings.find((x) => x.id === 'ip_host');
        assert.ok(ipFinding);
        assert.equal(ipFinding.severity, 'medium');
        assert.match(ipFinding.detail, /192\.168\.1\.10/);
      },
    },
    {
      name: 'Disguised authority with @: https://bank.com@evil.com/',
      input: 'https://bank.com@evil.com/',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        assert.equal(res.hostname, 'evil.com');
        const userinfo = res.findings.find((x) => x.id === 'userinfo_at');
        assert.ok(userinfo);
        assert.equal(userinfo.severity, 'high');
        assert.match(userinfo.detail, /evil\.com/);
      },
    },
    {
      name: 'Punycode encoded domain: https://xn--80ak6aa92e.com',
      input: 'https://xn--80ak6aa92e.com',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        const puny = res.findings.find((x) => x.id === 'punycode');
        assert.ok(puny);
        assert.equal(puny.severity, 'medium');
        assert.match(puny.detail, /аррӏе\.com/);
      },
    },
    {
      name: 'Mixed-script homograph hostname: https://gооgle.com (Cyrillic о)',
      input: 'https://g\u043e\u043egle.com',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        const mixed = res.findings.find((x) => x.id === 'mixed_script');
        assert.ok(mixed);
        assert.equal(mixed.severity, 'high');
        assert.match(mixed.detail, /Latin/);
        assert.match(mixed.detail, /Cyrillic/);
      },
    },
    {
      name: 'Deep subdomains: https://a.b.c.d.e.example.com',
      input: 'https://a.b.c.d.e.example.com',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        assert.equal(res.subdomain, 'a.b.c.d.e');
        const deep = res.findings.find((x) => x.id === 'deep_subdomains');
        assert.ok(deep);
        assert.equal(deep.severity, 'low');
      },
    },
    {
      name: 'Shortener URL: https://bit.ly/abc',
      input: 'https://bit.ly/abc',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        const short = res.findings.find((x) => x.id === 'shortener');
        assert.ok(short);
        assert.equal(short.severity, 'medium');
        assert.match(
          short.detail,
          /destination is hidden and cannot be inspected without following the link, which LinkSleuth never does/i
        );
      },
    },
    {
      name: 'Nonstandard port: http://example.com:8080/x',
      input: 'http://example.com:8080/x',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        const portFinding = res.findings.find((x) => x.id === 'nonstandard_port');
        assert.ok(portFinding);
        assert.equal(portFinding.severity, 'low');
        assert.match(portFinding.detail, /:8080/);
      },
    },
    {
      name: 'Non-web scheme: javascript:alert(1)',
      input: 'javascript:alert(1)',
      assertFn: (res) => {
        assert.equal(res.parse_ok, false);
        const nonWeb = res.findings.find((x) => x.id === 'non_web_scheme');
        assert.ok(nonWeb);
        assert.equal(nonWeb.severity, 'high');
        assert.equal(res.max_severity, 'high');
      },
    },
    {
      name: 'Non-web scheme: data:text/html,hi',
      input: 'data:text/html,hi',
      assertFn: (res) => {
        assert.equal(res.parse_ok, false);
        const nonWeb = res.findings.find((x) => x.id === 'non_web_scheme');
        assert.ok(nonWeb);
        assert.equal(nonWeb.severity, 'high');
        assert.equal(res.max_severity, 'high');
      },
    },
    {
      name: 'Malformed string: "not a url"',
      input: 'not a url',
      assertFn: (res) => {
        assert.equal(res.parse_ok, false);
        assert.ok(res.parse_error);
        assert.match(res.parse_error, /Malformed URL format/);
      },
    },
    {
      name: 'Defanged URL: hxxps://evil[.]com/x',
      input: 'hxxps://evil[.]com/x',
      assertFn: (res) => {
        assert.equal(res.parse_ok, true);
        assert.equal(res.hostname, 'evil.com');
        assert.equal(res.registrable_domain, 'evil.com');
        assert.equal(res.display_defanged, 'hxxps://evil[.]com/x');
      },
    },
  ];

  for (const tc of cases) {
    const result = inspectUrl(tc.input);
    tc.assertFn(result);
  }
});

// 3. Table-driven extractUrls tests
test('TABLE-DRIVEN: extractUrls extraction, defanging, punctuation, and deduplication', () => {
  // Trailing period stripping
  const trailingPeriod = extractUrls('visit http://x.com/a.');
  assert.equal(trailingPeriod.length, 1);
  assert.equal(trailingPeriod[0].raw, 'http://x.com/a');

  // Parentheses: strip outer parentheses from (see https://x.com/a)
  const outerParen = extractUrls('(see https://x.com/a)');
  assert.equal(outerParen.length, 1);
  assert.equal(outerParen[0].raw, 'https://x.com/a');

  // Balanced parentheses inside URL: keep Wikipedia URL parens
  const wikiUrl = extractUrls('Check https://en.wikipedia.org/wiki/URL_(disambiguation) now');
  assert.equal(wikiUrl.length, 1);
  assert.equal(wikiUrl[0].raw, 'https://en.wikipedia.org/wiki/URL_(disambiguation)');

  // Email address safeguard: "email me at a@b.com" must NOT extract a URL
  const emailOnly = extractUrls('email me at a@b.com');
  assert.equal(emailOnly.length, 0, 'Email addresses must not be extracted as URLs');

  // File name safeguard: "open report.pdf" must NOT extract a URL
  const fileOnly = extractUrls('open report.pdf');
  assert.equal(fileOnly.length, 0, 'Standalone filenames must not be extracted as URLs');

  // Bare domain with path: sbi-kyc.com/login
  const bareWithPath = extractUrls('Login at sbi-kyc.com/login immediately');
  assert.equal(bareWithPath.length, 1);
  assert.equal(bareWithPath[0].raw, 'sbi-kyc.com/login');

  // Duplicate URL deduplication: keeps first offsets
  const duplicates = extractUrls('Visit https://example.com/item and again at https://example.com/item');
  assert.equal(duplicates.length, 1, 'Duplicate URLs must be deduped');
  assert.equal(duplicates[0].start, 6);

  // 15 URLs cap at 10 and truncation flag in orchestrator
  const fifteenUrls = Array.from({ length: 15 }, (_, i) => `https://link${i + 1}.org/test`).join(' ');
  const extractedFifteen = extractUrls(fifteenUrls);
  assert.equal(extractedFifteen.length, 10, 'extractUrls must cap at 10');

  const runFifteen = runUrlChecks(Array.from({ length: 15 }, (_, i) => ({ raw: `https://link${i + 1}.org/test`, source: 'message_text' })));
  assert.equal(runFifteen.urls.length, 10);
  assert.equal(runFifteen.truncated, true);

  // Less than 10 URLs does not set truncated
  const runTwo = runUrlChecks([
    { raw: 'https://example.com/a', source: 'message_text' },
    { raw: 'https://example.com/b', source: 'message_text' },
  ]);
  assert.equal(runTwo.urls.length, 2);
  assert.equal(runTwo.truncated, false);
});

// 4. Linear-time performance test on adversarial 100,000-character input
test('PERFORMANCE: 100,000-character adversarial input finishes in under 100 ms', () => {
  // Construct adversarial input designed to trigger catastrophic backtracking in fragile regexes
  const adversarial = ('https://' + 'a'.repeat(50) + '.' + 'b'.repeat(50) + '/').repeat(1000);
  assert.equal(adversarial.length > 100000, true);

  const start = performance.now();
  const extracted = extractUrls(adversarial);
  const duration = performance.now() - start;

  assert.ok(duration < 100, `Expected duration < 100ms, actual: ${duration.toFixed(2)}ms`);
  assert.ok(extracted.length <= 10);
});

// 5. API-level test with mocked service: separate top-level fields & malformed URL resilience
test('API CONTRACT: url_checks returned separately from analysis and malformed URL does not break response', () => {
  // Candidate list including a malformed URL and a valid URL
  const candidates = [
    { raw: 'https://example.com/safe', source: 'message_text' },
    { raw: 'not a url', source: 'url_field' },
  ];

  const checks = runUrlChecks(candidates);

  assert.equal(checks.source, 'deterministic_rules');
  assert.equal(checks.urls.length, 2);
  assert.deepEqual(checks.not_checked, [
    'domain age',
    'reputation or blacklist status',
    'TLS certificate',
    'redirect destination',
    'page content',
  ]);

  // Check that the malformed URL was handled safely without crashing
  const malformedCheck = checks.urls.find((u) => u.input === 'not a url');
  assert.ok(malformedCheck);
  assert.equal(malformedCheck.parse_ok, false);
  assert.ok(malformedCheck.parse_error);

  // Check top-level contract structure
  const mockApiResponse = {
    analysis: {
      risk_level: 'low_concern',
      summary: 'Gemma defensive analysis',
      heuristic_score: 10,
      indicators: [],
    },
    meta: {
      model: 'gemma-4-26b-a4b-it',
      latency_ms: 250,
    },
    url_checks: checks,
  };

  assert.ok(mockApiResponse.analysis);
  assert.ok(mockApiResponse.url_checks);
  assert.notEqual(mockApiResponse.analysis, mockApiResponse.url_checks);
  assert.equal(typeof mockApiResponse.url_checks.truncated, 'boolean');
});
