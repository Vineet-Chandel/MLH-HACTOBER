/**
 * urlInspect.js
 * Safe, deterministic, purely rule-based URL extraction and inspection.
 *
 * HARD SAFETY RULES:
 * - Pure string parsing. NEVER makes any network request of any kind:
 *   no fetch, http, https, net, dns, WHOIS, certificate checks, or redirect following.
 * - Never claim domain age, reputation, blacklist status, or TLS certificate facts.
 * - Never output a "malicious" or "safe" verdict. Report observations only.
 * - Treat all extracted text as untrusted. Never render URLs as clickable links.
 * - Do not pass url_checks into the Gemma prompt.
 */

import { parse as parseDomain } from 'tldts';

// Small built-in list of well-known URL shorteners
export const KNOWN_SHORTENERS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'cutt.ly',
  'shorturl.at',
  'tiny.cc',
  'rb.gy',
  'qr.ae',
  's.id',
  'v.gd',
  'bl.ink',
  'clck.ru',
]);

// Sensitive authentication keywords
export const LOGIN_KEYWORDS = [
  'login',
  'signin',
  'verify',
  'verification',
  'secure',
  'update',
  'kyc',
  'otp',
  'banking',
  'password',
  'credential',
  'account-update',
];

// RFC 3492 Punycode decode implementation without deprecated node:punycode
function decodePunycodeLabel(input) {
  const BASE = 36;
  const TMIN = 1;
  const TMAX = 26;
  const SKEW = 38;
  const DAMP = 700;
  const INITIAL_BIAS = 72;
  const INITIAL_N = 128;
  const DELIMITER = '-';

  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  const output = [];

  const basicLength = input.lastIndexOf(DELIMITER);
  if (basicLength >= 0) {
    for (let j = 0; j < basicLength; j++) {
      output.push(input.charCodeAt(j));
    }
  }

  let inIdx = basicLength >= 0 ? basicLength + 1 : 0;
  while (inIdx < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (inIdx >= input.length) return input;
      const code = input.charCodeAt(inIdx++);
      const digit =
        code - 48 < 10
          ? code - 22
          : code - 65 < 26
          ? code - 65
          : code - 97 < 26
          ? code - 97
          : BASE;
      if (digit >= BASE) return input;
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const outLen = output.length + 1;
    let delta = Math.floor((i - oldi) / (oldi === 0 ? DAMP : 2));
    delta += Math.floor(delta / outLen);
    let k = 0;
    while (delta > Math.floor(((BASE - TMIN) * TMAX) / 2)) {
      delta = Math.floor(delta / (BASE - TMIN));
      k += BASE;
    }
    bias = Math.floor(k + ((BASE - TMIN + 1) * delta) / (delta + SKEW));
    n += Math.floor(i / outLen);
    i %= outLen;
    output.splice(i, 0, n);
    i++;
  }

  try {
    return String.fromCodePoint(...output);
  } catch {
    return input;
  }
}

/**
 * Decode any xn-- labels in a hostname into their Unicode equivalent.
 */
export function decodeHostnamePunycode(hostname) {
  if (!hostname) return '';
  return hostname
    .split('.')
    .map((label) => {
      if (label.toLowerCase().startsWith('xn--')) {
        return decodePunycodeLabel(label.slice(4).toLowerCase());
      }
      return label;
    })
    .join('.');
}

/**
 * Defang a URL string for safe display (cannot be auto-clicked).
 */
export function defangUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let defanged = urlStr
    .replace(/^http:\/\//i, 'hxxp://')
    .replace(/^https:\/\//i, 'hxxps://')
    .replace(/^(javascript|data|file):/i, '$1[:]');

  // Replace dots in hostname or authority area with [.]
  const schemeMatch = defanged.match(/^(hxxps?:\/\/)([^/?#]+)(.*)$/i);
  if (schemeMatch) {
    const [, proto, host, rest] = schemeMatch;
    return `${proto}${host.replace(/\./g, '[.]')}${rest}`;
  }

  // Bare domain or www-prefixed
  return defanged.replace(/\./g, '[.]');
}

/**
 * Normalizes defanged URL strings (e.g. hxxps://evil[.]com/path -> https://evil.com/path).
 */
export function normalizeDefanged(input) {
  if (!input || typeof input !== 'string') return '';
  let str = input.trim();

  // Normalize defanged protocols
  str = str.replace(/^hxxps:\/\//i, 'https://');
  str = str.replace(/^hxxp:\/\//i, 'http://');

  // Normalize defanged dots: [.], (.), [dot]
  str = str.replace(/\[\.\]|\(\.\)|\[dot\]/gi, '.');

  return str;
}

/**
 * Detect character scripts present in text (Latin, Cyrillic, Greek, etc.).
 */
function detectScripts(text) {
  const scripts = new Set();
  for (const char of text) {
    if (/\p{Script=Latin}/u.test(char)) scripts.add('Latin');
    else if (/\p{Script=Cyrillic}/u.test(char)) scripts.add('Cyrillic');
    else if (/\p{Script=Greek}/u.test(char)) scripts.add('Greek');
    else if (/\p{Script=Arabic}/u.test(char)) scripts.add('Arabic');
    else if (/\p{Script=Hebrew}/u.test(char)) scripts.add('Hebrew');
    else if (/\p{Script=Devanagari}/u.test(char)) scripts.add('Devanagari');
    else if (/\p{Script=Han}/u.test(char)) scripts.add('Han');
    else if (/\p{Script=Hiragana}/u.test(char)) scripts.add('Hiragana');
    else if (/\p{Script=Katakana}/u.test(char)) scripts.add('Katakana');
    else if (/\p{Script=Hangul}/u.test(char)) scripts.add('Hangul');
    else if (/\p{Script=Thai}/u.test(char)) scripts.add('Thai');
  }
  return scripts;
}

/**
 * Strips trailing punctuation from a URL match while preserving balanced parentheses.
 */
function stripTrailingPunctuation(str) {
  let s = str;
  while (s.length > 0) {
    const lastChar = s[s.length - 1];
    // Trailing punctuation characters to strip
    if (/[.,;:!?\]}'"]/.test(lastChar)) {
      s = s.slice(0, -1);
      continue;
    }
    // Only strip closing parenthesis if unbalanced
    if (lastChar === ')') {
      const openCount = (s.match(/\(/g) || []).length;
      const closeCount = (s.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        s = s.slice(0, -1);
        continue;
      }
    }
    if (lastChar === '>') {
      const openCount = (s.match(/</g) || []).length;
      const closeCount = (s.match(/>/g) || []).length;
      if (closeCount > openCount) {
        s = s.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return s;
}

/**
 * Normalizes a URL to a stable deduplication key.
 */
function toDedupKey(urlCandidate) {
  let normalized = normalizeDefanged(urlCandidate).trim().toLowerCase();
  if (!/^[a-zA-Z0-9+.-]+:\/\//.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  try {
    const parsed = new URL(normalized);
    // Discard default trailing slash for root paths in dedup key
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}${pathname}${parsed.search}`;
  } catch {
    return normalized;
  }
}

/**
 * Computes maximum severity from a list of findings.
 */
function computeMaxSeverity(findings) {
  const levels = ['high', 'medium', 'low', 'info'];
  for (const lvl of levels) {
    if (findings.some((f) => f.severity === lvl)) return lvl;
  }
  return 'none';
}

/**
 * Linear-time URL extraction regex.
 * Matches:
 * 1. Schemes: http://, https://, hxxp://, hxxps://
 * 2. www-prefixed domains: www.example.com
 * 3. Bare domains with a path: sbi-kyc.com/login
 * Rejects email addresses (a@b.com) and plain file names (report.pdf).
 */
const URL_EXTRACTION_REGEX =
  /(?:(?:https?|hxxps?):\/\/[^\s<>"'{}|^`]+|\bwww(?:\.|\[\.\]|\(\.\)|\[dot\])[a-zA-Z0-9-]{1,63}(?:\.|\[\.\]|\(\.\)|\[dot\])[a-zA-Z]{2,}(?:\/[^\s<>"'{}|^`]*)?|(?<![@a-zA-Z0-9_.-])[a-zA-Z0-9-]{1,63}(?:\.|\[\.\]|\(\.\)|\[dot\])[a-zA-Z]{2,}\/[^\s<>"'{}|^`]*)/gi;

/**
 * Extracts URLs from untrusted text.
 * Returns array of { raw, start, end }.
 * Deduplicates by normalized form, caps at 10 unique URLs, keeping first offsets.
 *
 * @param {string} text
 * @returns {Array<{ raw: string, start: number, end: number }>}
 */
export function extractUrls(text) {
  if (!text || typeof text !== 'string') return [];

  const found = [];
  const seenKeys = new Set();

  URL_EXTRACTION_REGEX.lastIndex = 0;
  let match;

  while ((match = URL_EXTRACTION_REGEX.exec(text)) !== null) {
    const rawMatch = match[0];
    const startIndex = match.index;

    // Strip trailing punctuation while respecting balanced parentheses
    const strippedRaw = stripTrailingPunctuation(rawMatch);
    if (!strippedRaw) continue;

    const endIndex = startIndex + strippedRaw.length;

    // Reject if preceded by '@' (email safeguard)
    if (startIndex > 0 && text[startIndex - 1] === '@') {
      continue;
    }

    const dedupKey = toDedupKey(strippedRaw);
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      found.push({
        raw: strippedRaw,
        start: startIndex,
        end: endIndex,
      });

      if (found.length >= 10) break;
    }
  }

  return found;
}

/**
 * Safe, deterministic, rule-based URL inspection on a single URL string.
 * NEVER makes network requests (no fetch, DNS, WHOIS, cert checks).
 *
 * @param {string} raw
 * @returns {Object} Inspection result object
 */
export function inspectUrl(raw) {
  const inputStr = typeof raw === 'string' ? raw.trim() : '';
  const defangedDisplay = defangUrl(inputStr);

  const result = {
    input: inputStr,
    normalized_url: '',
    display_defanged: defangedDisplay,
    parse_ok: false,
    parse_error: undefined,
    hostname: null,
    registrable_domain: null,
    subdomain: null,
    findings: [],
    max_severity: 'none',
  };

  if (!inputStr) {
    result.parse_error = 'No URL text provided for inspection.';
    return result;
  }

  // Pre-normalize defanged markers: hxxp://, [.], (.), [dot]
  const normalizedInput = normalizeDefanged(inputStr);

  // Check for non-web schemes early (javascript:, data:, file:, etc.)
  const schemeMatch = normalizedInput.match(/^([a-zA-Z0-9+.-]+):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== 'http' && scheme !== 'https') {
      result.parse_ok = false;
      result.normalized_url = normalizedInput;
      result.parse_error = `Non-web URI scheme '${scheme}:' is not supported for web inspection.`;
      result.findings.push({
        id: 'non_web_scheme',
        label: `Non-Web URI Scheme (${scheme}:)`,
        severity: 'high',
        detail: `URI uses non-web scheme '${scheme}:'. Non-web schemes may execute scripts, embed payloads, or access local resources and should not be opened.`,
      });
      result.max_severity = 'high';
      result.highest_severity = 'high';
      return result;
    }
  }

  // Add https:// to scheme-less candidates before parsing
  let urlCandidate = normalizedInput;
  if (!/^[a-zA-Z0-9+.-]+:\/\//.test(urlCandidate)) {
    urlCandidate = `https://${urlCandidate}`;
  }

  // Parse with standard WHATWG URL class
  let parsedUrl;
  try {
    parsedUrl = new URL(urlCandidate);
    result.parse_ok = true;
    result.normalized_url = parsedUrl.href;
    result.display_defanged = defangUrl(parsedUrl.href);
    result.hostname = parsedUrl.hostname;
  } catch (err) {
    result.parse_ok = false;
    result.parse_error = `Malformed URL format: ${err.message}`;
    return result;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const tldParsed = parseDomain(parsedUrl.href);

  result.registrable_domain = tldParsed.domain || null;
  result.subdomain = tldParsed.subdomain || null;

  // 1. Rule: no_https - http instead of https. LOW.
  if (parsedUrl.protocol === 'http:') {
    result.findings.push({
      id: 'no_https',
      label: 'Unencrypted HTTP Connection',
      severity: 'low',
      detail:
        'URL uses unencrypted http:// instead of https://. While this does not prove it is malicious, modern legitimate web services standardly require HTTPS.',
    });
  }

  // 2. Rule: ip_host - raw IPv4/IPv6 host. WHATWG converts decimal/hex IPs. MEDIUM.
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isIpv6 = hostname.startsWith('[') || hostname.includes(':');
  if (tldParsed.isIp || isIpv4 || isIpv6) {
    result.findings.push({
      id: 'ip_host',
      label: 'Direct IP Address Hostname',
      severity: 'medium',
      detail: `Hostname is a direct IP address (${hostname}) rather than a domain name. Legitimate web services standardly use registered domain names with TLS certificates.`,
    });
  }

  // 3. Rule: userinfo_at - credentials or "@" in the authority section. HIGH.
  if (parsedUrl.username || parsedUrl.password || inputStr.includes('@')) {
    result.findings.push({
      id: 'userinfo_at',
      label: 'Disguised Authority with Userinfo (@)',
      severity: 'high',
      detail: `URL contains user credentials or an '@' symbol in the authority component. Browsers will connect to the real host after the '@' ('${hostname}'), ignoring any misleading domain or brand preceding it.`,
    });
  }

  // 4. Rule: punycode - hostname labels starting with xn--. MEDIUM.
  const hasPunycode = hostname.split('.').some((l) => l.startsWith('xn--'));
  const decodedUnicode = decodeHostnamePunycode(hostname);
  if (hasPunycode) {
    result.findings.push({
      id: 'punycode',
      label: 'Internationalized Domain Name (Punycode)',
      severity: 'medium',
      detail: `Hostname uses Punycode encoding (${hostname}). Decoded Unicode representation: ${decodedUnicode}. Internationalized labels can be used to mimic authentic Latin characters.`,
    });
  }

  // 5. Rule: mixed_script - hostname mixes scripts (e.g. Latin plus Cyrillic). HIGH.
  const scriptsFound = detectScripts(decodedUnicode);
  if (scriptsFound.size > 1) {
    result.findings.push({
      id: 'mixed_script',
      label: 'Mixed-Script Homograph Risk',
      severity: 'high',
      detail: `Hostname mixes multiple character scripts (${Array.from(scriptsFound).join(', ')}). This technique is commonly used in homoglyph impersonation attacks.`,
    });
  }

  // 6. Rule: deep_subdomains - 4 or more subdomain levels. LOW.
  if (result.subdomain) {
    const subdomainLevels = result.subdomain.split('.').filter(Boolean).length;
    if (subdomainLevels >= 4) {
      result.findings.push({
        id: 'deep_subdomains',
        label: 'Deep Subdomain Nesting',
        severity: 'low',
        detail: `Hostname contains ${subdomainLevels} subdomain levels ('${result.subdomain}'). Deep subdomain structures are sometimes used to obscure the registrable domain.`,
      });
    }
  }

  // 7. Rule: long_hostname - over 40 characters. LOW.
  if (hostname.length > 40) {
    result.findings.push({
      id: 'long_hostname',
      label: 'Unusually Long Hostname',
      severity: 'low',
      detail: `Hostname is ${hostname.length} characters long (> 40 characters). Lengthy hostnames can push the real domain off-screen on smaller devices.`,
    });
  }

  // 8. Rule: shortener - hostname in small built-in list of URL shorteners. MEDIUM.
  if (
    KNOWN_SHORTENERS.has(hostname) ||
    (result.registrable_domain && KNOWN_SHORTENERS.has(result.registrable_domain))
  ) {
    result.findings.push({
      id: 'shortener',
      label: 'Known URL Shortener',
      severity: 'medium',
      detail:
        'Destination is hidden and cannot be inspected without following the link, which LinkSleuth never does.',
    });
  }

  // 9. Rule: nonstandard_port - explicit port other than 80/443. LOW.
  if (parsedUrl.port && parsedUrl.port !== '80' && parsedUrl.port !== '443') {
    result.findings.push({
      id: 'nonstandard_port',
      label: `Non-Standard Network Port (:${parsedUrl.port})`,
      severity: 'low',
      detail: `URL specifies an explicit non-standard network port (:${parsedUrl.port}). Legitimate web traffic standardly operates on port 80 (HTTP) or 443 (HTTPS).`,
    });
  }

  // 10. Rule: login_keywords - path or query contains authentication keywords. INFO.
  const pathQuery = `${parsedUrl.pathname}${parsedUrl.search}`.toLowerCase();
  const matchedKeywords = LOGIN_KEYWORDS.filter((kw) => {
    const kwRegex = new RegExp(`(?:^|[/?&=._-])${kw}(?:[/?&=._-]|$)`, 'i');
    return kwRegex.test(pathQuery);
  });

  if (matchedKeywords.length > 0) {
    result.findings.push({
      id: 'login_keywords',
      label: 'Authentication Keywords in Path/Query',
      severity: 'info',
      detail: `URL path or query contains authentication-related keywords ('${matchedKeywords.join(', ')}'). This is a weak signal only: legitimate services use these too.`,
    });
  }

  // Compute maximum severity
  result.max_severity = computeMaxSeverity(result.findings);
  result.highest_severity = result.max_severity;

  return result;
}

/**
 * Orchestrator: runs deterministic URL checks across collected candidate URLs.
 * Tracks source origin and truncation status.
 *
 * @param {Array<{ raw: string, source: "url_field" | "message_text" | "transcript" | "model_visible_urls" }>} candidates
 * @returns {Object} url_checks object
 */
export function runUrlChecks(candidates = []) {
  const not_checked = [
    'domain age',
    'reputation or blacklist status',
    'TLS certificate',
    'redirect destination',
    'page content',
  ];

  const unique = [];
  const seenKeys = new Set();

  for (const item of candidates) {
    const rawStr = typeof item === 'string' ? item : item?.raw;
    if (!rawStr || typeof rawStr !== 'string') continue;
    const trimmed = rawStr.trim();
    if (!trimmed) continue;

    const dedupKey = toDedupKey(trimmed);
    if (!seenKeys.has(dedupKey)) {
      seenKeys.add(dedupKey);
      unique.push({
        raw: trimmed,
        source: (typeof item === 'object' && item?.source) || 'message_text',
      });
    }
  }

  const truncated = unique.length > 10;
  const toProcess = unique.slice(0, 10);

  const inspected = toProcess.map((cand) => {
    try {
      const inspectRes = inspectUrl(cand.raw);
      return {
        ...inspectRes,
        source: cand.source,
      };
    } catch (err) {
      return {
        input: cand.raw,
        normalized_url: '',
        display_defanged: defangUrl(cand.raw),
        parse_ok: false,
        parse_error: `Inspection failure: ${err.message}`,
        hostname: null,
        registrable_domain: null,
        subdomain: null,
        findings: [
          {
            id: 'inspect_error',
            label: 'Inspection Error',
            severity: 'info',
            detail: `Failed to inspect URL: ${err.message}`,
          },
        ],
        max_severity: 'info',
        highest_severity: 'info',
        source: cand.source,
      };
    }
  });

  return {
    source: 'deterministic_rules',
    urls: inspected,
    truncated,
    not_checked,
  };
}
