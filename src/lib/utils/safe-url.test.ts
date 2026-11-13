import { describe, it, expect } from 'vitest';
import { httpUrlOrUndefined, safeHref, jsonLdString, jsonLdScript, safeRedirectPath } from './safe-url';

describe('safeHref', () => {
  it('keeps http, https, mailto and tel', () => {
    expect(safeHref('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHref('http://example.com')).toBe('http://example.com');
    expect(safeHref('mailto:a@example.com')).toBe('mailto:a@example.com');
    expect(safeHref('tel:+15095551212')).toBe('tel:+15095551212');
  });

  it('upgrades bare domains', () => {
    expect(safeHref('www.example.com/shop')).toBe('https://www.example.com/shop');
    expect(safeHref('example.com:8080/x')).toBe('https://example.com:8080/x');
  });

  it('rejects script-capable and odd schemes', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      ' javascript:alert(1)',
      'java\nscript:alert(1)',
      'java\tscript:alert(1)',
      '\u0001javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '/relative/path',
      '//evil.example',
      '',
      null,
      undefined,
      42,
    ]) {
      expect(safeHref(bad)).toBeUndefined();
    }
  });
});

describe('httpUrlOrUndefined', () => {
  it('only passes absolute http(s)', () => {
    expect(httpUrlOrUndefined('https://www.facebook.com/events/123/')).toBe('https://www.facebook.com/events/123/');
    expect(httpUrlOrUndefined('javascript:alert(1)')).toBeUndefined();
    expect(httpUrlOrUndefined('www.example.com')).toBeUndefined();
    expect(httpUrlOrUndefined('mailto:a@b.c')).toBeUndefined();
    expect(httpUrlOrUndefined({})).toBeUndefined();
  });
});

describe('jsonLd', () => {
  it('cannot break out of the script element', () => {
    const out = jsonLdScript({ name: '</script><script>alert(1)</script>', d: '<!-- x -->&' });
    // exactly one opening and one closing tag: ours
    expect(out.match(/<script/g)).toHaveLength(1);
    expect(out.match(/<\/script>/g)).toHaveLength(1);
    expect(out).not.toContain('<!--');
  });

  it('still parses to the same data', () => {
    const data = { name: 'A < B & C > D </script>', n: 1, nested: ['<x>'] };
    expect(JSON.parse(jsonLdString(data))).toEqual(data);
  });
});

describe('safeRedirectPath', () => {
  it('keeps same-site relative paths', () => {
    expect(safeRedirectPath('/')).toBe('/');
    expect(safeRedirectPath('/shops/12/claim')).toBe('/shops/12/claim');
    expect(safeRedirectPath('/invites/accept?token=abc&x=1')).toBe('/invites/accept?token=abc&x=1');
    expect(safeRedirectPath('/admin/events#top')).toBe('/admin/events#top');
  });

  it('falls back for anything that could leave the site', () => {
    for (const bad of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'evil.example',
      '/\t/evil.example',
      '/\n/evil.example',
      '/./../..//evil.example',
      '',
      null,
      undefined,
      5,
    ]) {
      const out = safeRedirectPath(bad);
      expect(out.startsWith('/')).toBe(true);
      expect(out.startsWith('//')).toBe(false);
      expect(out).not.toContain('\\');
    }
    expect(safeRedirectPath('https://evil.example')).toBe('/');
    expect(safeRedirectPath('//evil.example', '/home')).toBe('/home');
  });
});
