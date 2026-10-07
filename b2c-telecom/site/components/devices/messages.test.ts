import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';

type Tree = { [key: string]: string | Tree };
const lookup = (messages: Tree, dotted: string): unknown => dotted.split('.').reduce<unknown>((node, part) => (typeof node === 'object' && node !== null ? (node as Tree)[part] : undefined), messages);

/** Every literal key of a `t('...')` call of the devices namespace in the device components. */
function literalKeys(): { file: string; key: string }[] {
  const roots = [path.resolve(__dirname)];
  const found: { file: string; key: string }[] = [];
  for (const root of roots) {
    for (const file of readdirSync(root)) {
      if (!/\.(tsx?|ts)$/.test(file) || file.includes('.test.')) continue;
      const source = readFileSync(path.join(root, file), 'utf8');
      for (const match of source.matchAll(/\bt\('([A-Za-z0-9_.]+)'/g)) found.push({ file, key: match[1] as string });
    }
  }
  return found;
}

describe('devices messages', () => {
  const devices = { 'en-US': (en as unknown as { devices: Tree }).devices, 'de-DE': (de as unknown as { devices: Tree }).devices };

  it('every literal devices.* key used by the components exists in both locales as a non-empty string', () => {
    const keys = literalKeys();
    expect(keys.length).toBeGreaterThan(30);
    for (const { file, key } of keys) {
      // `t(...)` of the bundle namespace (tb) is called as tb(...), so every `t('...')` here is a devices key
      for (const locale of ['en-US', 'de-DE'] as const) {
        const value = lookup(devices[locale], key);
        expect(typeof value === 'string' && value !== '', `${file}: devices.${key} in ${locale}`).toBe(true);
      }
    }
  });

  it('the keys built from a mode, a color or an end of term exist for every value', () => {
    const dynamic = [...['outright', 'installments', 'lease'].flatMap((mode) => [`mode.${mode}`, `mode.description.${mode}`]), ...['black', 'silver', 'violet'].map((color) => `colorName.${color}`), 'endOfTerm.owned', 'endOfTerm.ownedAfterFinalPayment', 'endOfTerm.return'];
    for (const locale of ['en-US', 'de-DE'] as const) for (const key of dynamic) expect(typeof lookup(devices[locale], key), `${key} in ${locale}`).toBe('string');
  });

  it('the placeholders of a message are the same in both locales', () => {
    const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] as string).sort();
    const walk = (a: Tree, b: Tree, trail: string): void => {
      for (const [key, value] of Object.entries(a)) {
        const other = b[key];
        if (typeof value === 'string') expect(placeholders(String(other)), `${trail}${key}`).toEqual(placeholders(value));
        else walk(value, other as Tree, `${trail}${key}.`);
      }
    };
    walk(devices['en-US'], devices['de-DE'], 'devices.');
  });

  it('no German message is a copy of the English one (a sign of an untranslated key), apart from product words', () => {
    const same = new Set(['devices.memoryValue']);
    const walk = (a: Tree, b: Tree, trail: string): void => {
      for (const [key, value] of Object.entries(a)) {
        if (typeof value === 'string') {
          if (!same.has(`${trail}${key}`)) expect(b[key], `${trail}${key}`).not.toBe(value);
        } else walk(value, b[key] as Tree, `${trail}${key}.`);
      }
    };
    walk(devices['en-US'], devices['de-DE'], 'devices.');
  });
});
