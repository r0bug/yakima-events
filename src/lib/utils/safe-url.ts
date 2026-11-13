/**
 * Helpers for putting stored (untrusted) data into links, JSON-LD and redirects.
 * Pure functions - safe to import from both server and browser code.
 */

// Control characters and whitespace browsers strip before parsing a scheme
// (so "java\nscript:" and " javascript:" are still javascript:)
const STRIP_FOR_SCHEME = /[\u0000-\u0020\u007f-\u009f\u200b\u2028\u2029\ufeff]/g;

function schemeOf(value: string): string | null {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(value.replace(STRIP_FOR_SCHEME, ''));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Return `value` only if it is an absolute http(s) URL, else undefined.
 * Use for anything that will be stored and later rendered as a link.
 */
export function httpUrlOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2000) return undefined;
  const scheme = schemeOf(trimmed);
  if (scheme !== 'http' && scheme !== 'https') return undefined;
  try {
    const u = new URL(trimmed);
    return u.protocol === 'http:' || u.protocol === 'https:' ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sanitize a stored URL for use in an `href`. Only http, https, mailto and tel
 * survive; a bare domain ("www.example.com/x") is upgraded to https://.
 * Anything else (javascript:, data:, vbscript:, ...) returns undefined, so
 * callers should render plain text / no link in that case.
 */
export function safeHref(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const scheme = schemeOf(trimmed);
  if (scheme === 'http' || scheme === 'https') return httpUrlOrUndefined(trimmed);
  if (scheme === 'mailto' || scheme === 'tel') return trimmed.replace(STRIP_FOR_SCHEME, '');
  if (scheme !== null) {
    // "example.com:8080/path" parses as a scheme; allow it only as host:port
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+:\d{1,5}(\/|$)/i.test(trimmed)) {
      return httpUrlOrUndefined(`https://${trimmed}`);
    }
    return undefined;
  }

  // No scheme: accept things that look like a domain, never relative paths
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(trimmed)) {
    return httpUrlOrUndefined(`https://${trimmed}`);
  }
  return undefined;
}

/**
 * Serialize data for a `<script type="application/ld+json">` block. Escapes the
 * characters that could close the script element or start an HTML comment, so
 * stored text such as `</script><script>...` stays inert JSON.
 */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Full JSON-LD script element, ready for `{@html}` inside `<svelte:head>`. */
export function jsonLdScript(data: unknown): string {
  return `<script type="application/ld+json">${jsonLdString(data)}</` + `script>`;
}

/**
 * Validate a post-login return target. Only same-site relative paths are
 * allowed ("/shops/12/claim?x=1"); absolute URLs, scheme-relative ("//evil"),
 * backslash tricks ("/\evil") and control characters all fall back.
 */
export function safeRedirectPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback;
  if (value.length === 0 || value.length > 2000) return fallback;
  if (value[0] !== '/') return fallback;
  if (value.startsWith('//') || value.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    // Must still be same-origin once a browser resolves it
    const base = 'https://same-site.invalid';
    const resolved = new URL(value, base);
    if (resolved.origin !== base) return fallback;
    // Normalised form defeats "/./" and "/../" games and dot-segment "//" results
    const normalised = resolved.pathname + resolved.search + resolved.hash;
    if (normalised.startsWith('//')) return fallback;
    return normalised;
  } catch {
    return fallback;
  }
}
