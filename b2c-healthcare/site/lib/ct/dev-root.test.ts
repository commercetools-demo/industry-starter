import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('dev root (MALVA_FIXTURES in-memory Custom Objects and Customers)', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    (globalThis as { __malvaDevRoot?: unknown }).__malvaDevRoot = undefined;
  });

  it('is null in production and without MALVA_FIXTURES', async () => {
    const { loadDevRoot } = await import('@/lib/ct/fixtures');
    vi.stubEnv('MALVA_FIXTURES', '');
    expect(await loadDevRoot()).toBeNull();
    vi.stubEnv('MALVA_FIXTURES', '1');
    vi.stubEnv('NODE_ENV', 'production');
    expect(await loadDevRoot()).toBeNull();
  });

  it('serves the seed schedule, labs and the patient reference; an unknown customer is 404', async () => {
    vi.stubEnv('MALVA_FIXTURES', '1');
    const { loadDevRoot } = await import('@/lib/ct/fixtures');
    const root = (await loadDevRoot())!;
    const lab = await root.customObjects().withContainerAndKey({ container: 'malva-lab', key: 'LAB-50301' }).get().execute();
    expect((lab.body.value as { name: string }).name).toBe('Complete blood count');
    const sam = await root.customers().withId({ ID: 'fixture-sam-rivera' }).get().execute();
    expect((sam.body.custom?.fields as { patientRef: string }).patientRef).toBe('pt_8k2m4q7x');
    await expect(root.customers().withId({ ID: 'nobody' }).get().execute()).rejects.toMatchObject({ statusCode: 404 });
  });

  it('applies address actions with optimistic concurrency', async () => {
    vi.stubEnv('MALVA_FIXTURES', '1');
    const { loadDevRoot } = await import('@/lib/ct/fixtures');
    const root = (await loadDevRoot())!;
    const c = () => root.customers().withId({ ID: 'fixture-alex-chen' });
    const before = (await c().get().execute()).body;
    const after = (await c().post({ body: { version: before.version, actions: [{ action: 'addAddress', address: { country: 'US', city: 'Reno' } }] } }).execute()).body;
    expect(after.addresses).toHaveLength(2);
    await expect(c().post({ body: { version: before.version, actions: [] } }).execute()).rejects.toMatchObject({ statusCode: 409 });
  });
});
