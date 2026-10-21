import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(join(process.cwd(), name), 'utf8');

describe('Agent rules', () => {
  it('New contributor: CLAUDE.md and AGENTS.md name the commands, the lint rules and the two plan files', () => {
    const agents = read('AGENTS.md');
    const claude = read('CLAUDE.md');
    const both = `${agents}\n${claude}`;
    expect(claude).toContain('@AGENTS.md');
    expect(agents).toContain('BEGIN:nextjs-agent-rules');
    for (const needle of [
      'npm run check',
      'npm run build',
      'plans/TODO-MANUAL-TESTING.md',
      'plans/QUESTIONS.md',
      '@/i18n/routing',
      'BFF boundary',
      'products().search()',
      "import 'server-only'",
      '.env.local',
    ]) {
      expect(both, needle).toContain(needle);
    }
  });

  it('AGENTS.md names the tokens and the atom list', () => {
    const agents = read('AGENTS.md');
    for (const needle of [
      '--ink', '--canvas', '--accent', '--teal-text', '--danger-text', 'app/tokens.css', 'buttonClasses',
      'Button', 'ButtonLink', 'IconButton', 'Chip', 'Field', 'OptionButton', 'ColorSwatch', 'Stepper',
      'Card', 'Badge', 'AvailabilityDot', 'Rating', 'Drawer', 'Modal', 'Steps', 'ToastProvider',
      'components/ui/icons.ts', 'no hex',
    ]) {
      expect(agents, needle).toContain(needle);
    }
  });

  it('AGENTS.md lists the six files for a new resource', () => {
    const agents = read('AGENTS.md');
    for (const needle of [
      'lib/ct/<namespace>.ts',
      'lib/mappers/<namespace>.ts',
      'lib/types.ts',
      'app/api/<namespace>/route.ts',
      'hooks/',
      'lib/cache-keys.ts',
    ]) {
      expect(agents, needle).toContain(needle);
    }
  });

  it('AGENTS.md lists handle, requireCustomer, changeMarket, cachedPublic, updateWithRetry', () => {
    const agents = read('AGENTS.md');
    for (const needle of ['handle', 'requireCustomer', 'changeMarket', 'cachedPublic', 'updateWithRetry']) {
      expect(agents, needle).toContain(needle);
    }
  });
});
