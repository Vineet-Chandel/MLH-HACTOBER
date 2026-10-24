/**
 * LinkSleuth Pure Shared Defang Helper
 * Safe on garbage, empty, and adversarial long inputs (linear time, no ReDoS).
 * Idempotent: defang(defang(x)) === defang(x).
 * Zero network calls.
 */

const URL_TOKEN_REGEX =
  /(?:(?:hxxps?|https?):\/\/[^\s"'<>]+|(?:javascript|data|file):[^\s"'<>]+|[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?(?:\[\.\]|\(\.\)|\.)(?:[a-zA-Z]{2,}|xn--[a-zA-Z0-9]+)(?::\d+)?(?:\/[^\s"'<>]*)?|\b\d{1,3}(?:\[\.\]|\.)\d{1,3}(?:\[\.\]|\.)\d{1,3}(?:\[\.\]|\.)\d{1,3}(?::\d+)?(?:\/[^\s"'<>]*)?)/gi;

/**
 * Defangs a single URL or domain string.
 *
 * - http -> hxxp, https -> hxxps (case-insensitive scheme)
 * - every "." in the host portion -> "[.]" (keep path/query unchanged)
 * - "://" stays as "://"
 * - "@" in the authority section -> "[@]"
 * - IPv4 hosts get "[.]" between octets
 * - Idempotent: defang(defang(x)) === defang(x)
 * - Safe on garbage, empty, non-URL text, and 100k-char inputs
 *
 * @param {string} input - URL or text candidate
 * @returns {string} Defanged string
 */
export function defang(input) {
  if (typeof input !== 'string' || !input) return '';

  const leadingWsMatch = input.match(/^\s*/);
  const trailingWsMatch = input.match(/\s*$/);
  const leadingWs = leadingWsMatch ? leadingWsMatch[0] : '';
  const trailingWs = trailingWsMatch ? trailingWsMatch[0] : '';
  const trimmed = input.slice(leadingWs.length, input.length - trailingWs.length);

  if (!trimmed) return input;

  // Separate trailing punctuation (sentence punctuation: . , ; : ! ? ) ] } " ')
  let punc = '';
  let core = trimmed;
  const puncMatch = trimmed.match(/[.,;:!?)]+$/);
  if (puncMatch) {
    punc = puncMatch[0];
    core = trimmed.slice(0, trimmed.length - punc.length);
  }

  // 1. Check scheme
  const schemeMatch = core.match(/^([a-zA-Z][a-zA-Z0-9+.-]*)(:\/\/)(.*)$/s);
  if (schemeMatch) {
    const rawScheme = schemeMatch[1];
    const delim = schemeMatch[2]; // '://'
    const rest = schemeMatch[3];

    let newScheme = rawScheme;
    const lowerScheme = rawScheme.toLowerCase();
    if (lowerScheme === 'http' || lowerScheme === 'hxxp') {
      newScheme = 'hxxp';
    } else if (lowerScheme === 'https' || lowerScheme === 'hxxps') {
      newScheme = 'hxxps';
    }

    // Split authority from path/query/fragment
    let firstDelim = -1;
    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];
      if (ch === '/' || ch === '?' || ch === '#') {
        firstDelim = i;
        break;
      }
    }

    const auth = firstDelim === -1 ? rest : rest.slice(0, firstDelim);
    const tail = firstDelim === -1 ? '' : rest.slice(firstDelim);

    // Defang authority: '@' -> '[@]', dots -> '[.]'
    // Idempotent: replace '[@]' or '@' with '[@]', and '[.]' or '.' with '[.]'
    const defangedAuth = auth
      .replace(/\[@\]|@/g, '[@]')
      .replace(/\[\.\]|\./g, '[.]');

    return `${leadingWs}${newScheme}${delim}${defangedAuth}${tail}${punc}${trailingWs}`;
  }

  // 2. Scheme-less candidate
  // If core contains whitespace, it's not a single URL token
  if (/\s/.test(core)) {
    return input;
  }

  let firstDelim = -1;
  for (let i = 0; i < core.length; i++) {
    const ch = core[i];
    if (ch === '/' || ch === '?' || ch === '#') {
      firstDelim = i;
      break;
    }
  }

  const auth = firstDelim === -1 ? core : core.slice(0, firstDelim);
  const tail = firstDelim === -1 ? '' : core.slice(firstDelim);

  // Check if auth looks like a domain, IP, or authority
  const isIpv4 = /^\d{1,3}(?:\[\.\]|\.)\d{1,3}(?:\[\.\]|\.)\d{1,3}(?:\[\.\]|\.)\d{1,3}(?::\d+)?$/.test(auth);
  const hasDomainDot = /(?:\[\.\]|\.)(?:[a-zA-Z]{2,}|xn--[a-zA-Z0-9]+|\p{L}{2,})(?::\d+)?$/u.test(auth);
  const hasAt = /@/.test(auth);

  if (!isIpv4 && !hasDomainDot && !hasAt) {
    return input;
  }

  const defangedAuth = auth
    .replace(/\[@\]|@/g, '[@]')
    .replace(/\[\.\]|\./g, '[.]');

  return `${leadingWs}${defangedAuth}${tail}${punc}${trailingWs}`;
}

/**
 * Finds all URLs in a string and replaces each with its defanged representation,
 * preserving all surrounding text, spaces, and punctuation intact.
 *
 * @param {string} text - Plain text containing zero or more URLs.
 * @returns {string} Text with all URLs defanged.
 */
export function defangText(text) {
  if (typeof text !== 'string' || !text) return '';

  return text.replace(URL_TOKEN_REGEX, (match) => {
    return defang(match);
  });
}
