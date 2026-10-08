import { join, resolve } from 'node:path';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { restrictionConfigs } from './restrictions.mjs';

const root = resolve(__dirname, '..');
const linter = new Linter({ configType: 'flat', cwd: root });
const config = [
  { files: ['**/*.ts', '**/*.tsx', '**/*.mjs'], languageOptions: { parser: tseslint.parser } },
  ...restrictionConfigs,
] as Linter.Config[];

function lint(filename: string, code: string): string[] {
  return linter.verify(code, config, { filename: join(root, filename) }).map((message) => `${message.ruleId}: ${message.message}`);
}

const LOCALE_UI = ['app/[locale]/page.tsx', 'app/[locale]/doctors/page.tsx', 'app/[locale]/layout.tsx', 'components/layout/Header.tsx', 'components/ui/Button.tsx'];

describe('storefront-locale-routing: Locale-aware navigation only', () => {
  it('Bare Next link: next/link fails in every locale UI location', () => {
    for (const file of LOCALE_UI) {
      const problems = lint(file, "import Link from 'next/link';\nexport const x = Link;\n");
      expect(problems.join('\n'), file).toMatch(/no-restricted-imports.*Link from '@\/i18n\/routing'/);
    }
  });

  it('Bare Next link: navigation helpers from next/navigation fail (redirect, useRouter, usePathname)', () => {
    for (const file of LOCALE_UI) {
      for (const name of ['redirect', 'useRouter', 'usePathname', 'useSearchParams']) {
        const problems = lint(file, `import { ${name} } from 'next/navigation';\nexport const x = ${name};\n`);
        expect(problems.join('\n'), `${file} ${name}`).toMatch(/no-restricted-imports/);
      }
    }
  });

  it('Bare Next link: notFound from next/navigation is the one allowed import', () => {
    for (const file of LOCALE_UI) {
      expect(lint(file, "import { notFound } from 'next/navigation';\nexport const x = notFound;\n"), file).toEqual([]);
    }
  });

  it('Bare Next link: helpers from @/i18n/routing are accepted', () => {
    const code = "import { Link, redirect, usePathname, useRouter, getPathname } from '@/i18n/routing';\nexport const x = [Link, redirect, usePathname, useRouter, getPathname];\n";
    for (const file of LOCALE_UI) expect(lint(file, code), file).toEqual([]);
  });
});
