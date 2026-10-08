// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Credential, CredentialSource } from '@/lib/clinical/types';
import { checkCredential, checkCredentialDetailed } from './credentials';

const cred = (over: Partial<Credential> = {}): Credential => ({
  patientRef: 'pt_sam', class: 'schedule-iv', issuer: 'Demo', validFrom: '2026-01-01', validTo: '2027-01-01', status: 'active', ...over,
});
const sourceOf = (...credentials: Credential[]): CredentialSource => ({
  listForPatient: async (ref) => credentials.filter((c) => c.patientRef === ref),
  get: async (ref, cls) => credentials.find((c) => c.patientRef === ref && c.class === cls) ?? null,
});
const NOW = new Date('2026-10-08T12:00:00Z');

describe('credentialed-purchase-scope: checkCredential (U-11)', () => {
  it('Credential in scope permits purchase: OK, and the credential that allowed it is returned', async () => {
    const result = await checkCredentialDetailed('pt_sam', 'schedule-iv', NOW, sourceOf(cred()));
    expect(result).toMatchObject({ code: 'OK', credential: { class: 'schedule-iv', validTo: '2027-01-01' } });
    expect(await checkCredential('pt_sam', 'schedule-iv', NOW, sourceOf(cred()))).toBe('OK');
  });

  it('No credential refuses purchase: NONE', async () => {
    expect(await checkCredential('pt_alex', 'schedule-iv', NOW, sourceOf(cred()))).toBe('NONE');
  });

  it('Credential out of scope: WRONG_SCOPE is distinct from NONE', async () => {
    expect(await checkCredential('pt_sam', 'schedule-ii', NOW, sourceOf(cred()))).toBe('WRONG_SCOPE');
  });

  it('Credential expired between cart and order: valid on the cart date, EXPIRED on the order date', async () => {
    const source = sourceOf(cred({ validTo: '2026-10-10' }));
    expect(await checkCredential('pt_sam', 'schedule-iv', new Date('2026-10-08T12:00:00Z'), source)).toBe('OK');
    expect(await checkCredential('pt_sam', 'schedule-iv', new Date('2026-10-12T12:00:00Z'), source)).toBe('EXPIRED');
  });

  it('the last valid day still holds (validTo is inclusive)', async () => {
    expect(await checkCredential('pt_sam', 'schedule-iv', new Date('2026-10-10T23:00:00Z'), sourceOf(cred({ validTo: '2026-10-10' })))).toBe('OK');
  });

  it('a credential marked expired is EXPIRED whatever its dates say', async () => {
    expect(await checkCredential('pt_sam', 'schedule-iv', NOW, sourceOf(cred({ status: 'expired' })))).toBe('EXPIRED');
  });

  it('Verification still pending: PENDING (not ineligible), also for one not yet in force', async () => {
    expect(await checkCredential('pt_jordan', 'schedule-iv', NOW, sourceOf(cred({ patientRef: 'pt_jordan', status: 'pending' })))).toBe('PENDING');
    expect(await checkCredential('pt_sam', 'schedule-iv', NOW, sourceOf(cred({ validFrom: '2026-11-01' })))).toBe('PENDING');
  });

  it('a revoked credential counts as none', async () => {
    expect(await checkCredential('pt_sam', 'schedule-iv', NOW, sourceOf(cred({ status: 'revoked' })))).toBe('NONE');
  });

  it('a valid credential wins over an older expired one for the same class', async () => {
    expect(await checkCredential('pt_sam', 'schedule-iv', NOW, sourceOf(cred({ status: 'expired', validTo: '2025-12-31' }), cred()))).toBe('OK');
  });

  it('Uncontrolled goods unaffected: no class means OK without even reading the register', async () => {
    const throwing: CredentialSource = { listForPatient: async () => { throw new Error('register read'); }, get: async () => { throw new Error('register read'); } };
    expect(await checkCredential('pt_nobody', null, NOW, throwing)).toBe('OK');
    expect(await checkCredential('pt_nobody', undefined, NOW, throwing)).toBe('OK');
  });
});
