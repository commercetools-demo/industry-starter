// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';

const lines = readFileSync(path.resolve(__dirname, '../.env.example'), 'utf8').split('\n');
const assignments = new Map<string, string>();
for (const line of lines) {
  const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
  if (match) assignments.set(match[1], match[2]);
}

const NAMES = [
  'CTP_PROJECT_KEY',
  'CTP_AUTH_URL',
  'CTP_API_URL',
  'CTP_CLIENT_ID',
  'CTP_CLIENT_SECRET',
  'CTP_SCOPES',
  'CTP_CHECKOUT_APP_KEY',
  'SESSION_SECRET',
  'DEMO_SHOW_RESET_LINK',
  'SERVICEABILITY_STUB',
];

describe('.env.example', () => {
  it('names every variable from the architecture contract', () => {
    for (const name of NAMES) expect(assignments.has(name), name).toBe(true);
  });

  it('holds no value for secrets and owner-supplied settings', () => {
    for (const name of ['CTP_CLIENT_ID', 'CTP_CLIENT_SECRET', 'CTP_SCOPES', 'CTP_CHECKOUT_APP_KEY', 'SESSION_SECRET']) {
      expect(assignments.get(name), name).toBe('');
    }
  });

  it('never uses the public prefix and carries no seed variables', () => {
    for (const line of lines) {
      expect(line).not.toContain('NEXT_PUBLIC_');
      expect(line).not.toContain('CTP_SEED_');
    }
  });
});
