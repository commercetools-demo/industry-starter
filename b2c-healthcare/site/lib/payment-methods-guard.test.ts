import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', '.next', 'scripts', 'test']);

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

const code = (file: string): string =>
  readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');

describe('payment-methods: the provider token never leaves the adapter', () => {
  const files = ['app', 'lib', 'components', 'hooks'].flatMap((d) => sources(join(ROOT, d)));

  it('no code reads a PaymentMethod token value (not even the adapter: it copies descriptor fields only)', () => {
    const offenders = files.filter((f) => /\.token\??\.value|PaymentMethodToken|token:\s*\{\s*value/.test(code(f)));
    expect(offenders).toEqual([]);
  });

  it('the saved-method modules write no log line at all (nothing about a card can be logged)', () => {
    for (const rel of ['lib/ct/stored-methods.ts', 'lib/ct/payment-methods.ts', 'lib/payment-route.ts', 'components/payment-methods/PaymentMethodList.tsx', 'hooks/use-payment-methods.ts']) {
      expect(code(join(ROOT, rel)), rel).not.toMatch(/\blog\.(error|warn|info|debug)|console\./);
    }
    for (const f of files.filter((p) => p.includes(`${join('app', 'api', 'payment-methods')}`))) expect(code(f), f).not.toMatch(/\blog\.|console\./);
  });

  it('the descriptor type has no field that could carry a card number or a token', () => {
    const source = readFileSync(join(ROOT, 'lib/checkout/payment-provider.ts'), 'utf8');
    const block = /export interface StoredMethodDescriptor \{([\s\S]*?)\n\}/.exec(source)?.[1] ?? '';
    const fields = [...block.matchAll(/^\s+(\w+)\??:/gm)].map((m) => m[1]);
    expect(fields).toEqual(['id', 'brand', 'last4', 'expMonth', 'expYear', 'isDefault']);
  });

  it('no component renders a card input: the card form lives in the Checkout iframe (also covered by checkout/no-card-fields)', () => {
    for (const f of files.filter((p) => p.includes(`${join('components', 'payment-methods')}`))) expect(code(f), f).not.toMatch(/autoComplete=|type="(text|tel|number)"|<input/);
  });
});
