import de from './de-DE.json';
import en from './en-US.json';

function leaves(value: unknown, prefix: string, out: Map<string, string>): Map<string, string> {
  if (typeof value === 'string') out.set(prefix, value);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) leaves(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('content messages', () => {
  it('content.* keys and placeholders match in en-US and de-DE', () => {
    const enLeaves = leaves(en.content, '', new Map());
    const deLeaves = leaves(de.content, '', new Map());
    expect([...deLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
    expect(enLeaves.size).toBeGreaterThan(30);
    for (const [key, text] of enLeaves) {
      expect(text.trim(), key).not.toBe('');
      expect(placeholders(deLeaves.get(key) ?? ''), key).toEqual(placeholders(text));
    }
  });
});
