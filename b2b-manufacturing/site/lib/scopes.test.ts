import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRONTEND_SCOPES, PROVISIONING_SCOPES, withProject } from './scopes';

const example = readFileSync(path.join(process.cwd(), '.env.example'), 'utf8');

describe('malva-bff-and-session › Scope review', () => {
  it('never asks for an admin scope', () => {
    for (const scope of [...Object.keys(FRONTEND_SCOPES), ...Object.keys(PROVISIONING_SCOPES)]) expect(scope).not.toMatch(/^manage_project$|^manage_api_clients$/);
  });
  it('every scope has a reason', () => {
    for (const [scope, reason] of [...Object.entries(FRONTEND_SCOPES), ...Object.entries(PROVISIONING_SCOPES)]) expect(reason.length, scope).toBeGreaterThan(10);
  });
  it('.env.example lists every scope with its reason', () => {
    for (const [scope, reason] of [...Object.entries(FRONTEND_SCOPES), ...Object.entries(PROVISIONING_SCOPES)]) {
      expect(example, scope).toContain(`# ${scope}: ${reason}`);
    }
  });
  it('formats CTP_SCOPES with the project key', () => {
    expect(withProject({ a: 'x', b: 'y' }, 'p')).toBe('a:p b:p');
  });
});

describe('malva-bff-and-session › Elevated operation needs a separate client', () => {
  it('registration scopes live only in the provisioning set, with separate variables', () => {
    expect(Object.keys(PROVISIONING_SCOPES)).toContain('manage_business_units');
    expect(example).toMatch(/^CTP_PROV_SCOPES=\s*$/m);
  });
});
