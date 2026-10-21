// @vitest-environment node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const cwd = process.cwd();
const eslint = new ESLint({ cwd, overrideConfigFile: join(cwd, 'eslint.config.mjs') });

async function lint(fixture, filePath) {
  const code = readFileSync(join(cwd, 'eslint', 'fixtures', fixture), 'utf8');
  const [result] = await eslint.lintText(code, { filePath: join(cwd, filePath) });
  return result.messages.filter((m) => m.ruleId !== null || m.fatal);
}

const ids = (messages) => messages.map((m) => m.ruleId);

describe('BFF boundary rules', () => {
  it('Server import in a client file: lib/ct import fails with the boundary rule', async () => {
    const messages = await lint('boundary-ct.bad.tsx', 'components/widget.tsx');
    const hit = messages.find((m) => m.ruleId === 'local/no-server-in-client');
    expect(hit?.messageId).toBe('serverInClient');
    expect(hit?.message).toContain('BFF boundary');
  });

  it('Server import in a client file: @commercetools import fails', async () => {
    const messages = await lint('boundary-sdk.bad.tsx', 'components/widget.tsx');
    expect(ids(messages)).toContain('local/no-server-in-client');
    expect(ids(messages)).toContain('no-restricted-imports');
  });

  it('use client file importing lib/ct/image-config passes (the image transforms are shared)', async () => {
    expect(await lint('image-config.good.tsx', 'components/widget.tsx')).toEqual([]);
  });

  it('use client file importing lib/types passes', async () => {
    expect(await lint('boundary.good.tsx', 'components/widget.tsx')).toEqual([]);
  });

  it('@commercetools import is allowed in lib/ct and lib/mappers', async () => {
    expect(ids(await lint('client-builder.tsx', 'lib/mappers/x.ts'))).not.toContain('no-restricted-imports');
  });
});

describe('Locale navigation rules', () => {
  it('Bare next/link in locale UI fails', async () => {
    expect(ids(await lint('next-link.bad.tsx', 'components/nav.tsx'))).toContain('no-restricted-imports');
    expect(ids(await lint('next-link.bad.tsx', 'app/[locale]/nav.tsx'))).toContain('no-restricted-imports');
  });

  it('useRouter from next/navigation in locale UI fails', async () => {
    expect(ids(await lint('next-navigation.bad.tsx', 'components/back.tsx'))).toContain('no-restricted-imports');
  });

  it('notFound from next/navigation passes', async () => {
    expect(await lint('next-navigation.good.tsx', 'app/[locale]/page.tsx')).toEqual([]);
  });

  it('Link from @/i18n/routing passes', async () => {
    expect(await lint('i18n-link.good.tsx', 'components/nav.tsx')).toEqual([]);
  });
});

describe('Quality gates', () => {
  it('any fails', async () => {
    expect(ids(await lint('any.bad.ts', 'lib/value.ts'))).toContain('@typescript-eslint/no-explicit-any');
  });

  it('Raw hex in a component fails', async () => {
    expect(ids(await lint('raw-hex.bad.tsx', 'components/badge.tsx'))).toContain('no-restricted-syntax');
  });

  it('Tailwind arbitrary hex fails', async () => {
    expect(ids(await lint('tailwind-hex.bad.tsx', 'app/[locale]/badge.tsx'))).toContain('no-restricted-syntax');
  });

  it('Raw hex in a test file is not flagged', async () => {
    expect(ids(await lint('raw-hex.bad.tsx', 'components/badge.test.tsx'))).not.toContain('no-restricted-syntax');
  });

  it('new ClientBuilder outside lib/ct/client.ts fails', async () => {
    expect(ids(await lint('client-builder.tsx', 'lib/ct/other.ts'))).toContain('no-restricted-syntax');
    expect(ids(await lint('client-builder.tsx', 'components/x.tsx'))).toContain('no-restricted-syntax');
  });

  it('new ClientBuilder in lib/ct/client.ts passes', async () => {
    expect(await lint('client-builder.tsx', 'lib/ct/client.ts')).toEqual([]);
  });
});
