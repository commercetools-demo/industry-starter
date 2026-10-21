import { describe, expect, it } from 'vitest';
import { safeJsonLd } from './json-ld';

describe('safeJsonLd', () => {
  it('less-than is escaped in json-ld', () => {
    expect(safeJsonLd({ name: 'a<b' })).toBe('{"name":"a\\u003cb"}');
  });
  it('product name with a closing script tag cannot break out', () => {
    const out = safeJsonLd({ '@type': 'Product', name: '</script><script>window.__xss=1</script>' });
    expect(out).not.toContain('</script');
    expect(out).not.toContain('<');
    expect(JSON.parse(out).name).toBe('</script><script>window.__xss=1</script>');
  });
  it('line separators are escaped and the value round trips', () => {
    const value = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}c`;
    const out = safeJsonLd({ t: value });
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(JSON.parse(out).t).toBe(value);
  });
});
