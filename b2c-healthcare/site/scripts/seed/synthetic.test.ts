import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PATIENTS } from './data/patients';
import { createFakeRoot } from './fake-root';
import { makeCtx } from './lib';
import { runSeed } from './seed';
import { assertSynthetic, isSyntheticEmail, isSyntheticPhone } from './synthetic';
import { runVerify } from './verify';

describe('seed test-environment guard', () => {
  it('Test environment holds nobody real: the seed data passes (example.com emails, 555-01xx phones)', () => {
    expect(() => assertSynthetic()).not.toThrow();
    expect(PATIENTS.every((p) => isSyntheticEmail(p.email) && isSyntheticPhone(p.address.phone))).toBe(true);
  });

  it('Test environment holds nobody real: a real-looking email, phone or guest is refused, naming the record but not the value', () => {
    const bad = {
      patients: [{ slug: 'x', email: 'someone.real@gmail.com', address: { phone: '+1 212 555 0101' } }, { slug: 'y', email: 'y@example.com', address: { phone: '+1 212 867 5309' } }],
      bookings: [{ reference: 'BK-1', guest: { email: 'guest@company.org', phone: '+1 415 555 7788' } }],
    };
    let message = '';
    try {
      assertSynthetic(bad);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/patient x: email/);
    expect(message).toMatch(/patient y: phone/);
    expect(message).toMatch(/booking BK-1: guest email/);
    expect(message).toMatch(/booking BK-1: guest phone/);
    expect(message).not.toMatch(/gmail|867|company/);
  });

  it('Test environment holds nobody real: the allow-list is strict (look-alike domains and 555 outside 01xx fail)', () => {
    expect(isSyntheticEmail('a@example.com.evil.io')).toBe(false);
    expect(isSyntheticEmail('a@notexample.com')).toBe(false);
    expect(isSyntheticEmail('A@Example.com')).toBe(true);
    expect(isSyntheticPhone('+1 212 555 0199')).toBe(true);
    expect(isSyntheticPhone('+1 212 555 1234')).toBe(false);
  });

  it('runSeed stops before the first write when a patient is not synthetic', async () => {
    const fake = createFakeRoot();
    const original = PATIENTS[0].email;
    PATIENTS[0].email = 'real.person@gmail.com';
    try {
      await expect(runSeed({ ...makeCtx(fake.root, { dryRun: false }, () => {}), pauseMs: 0 }, {})).rejects.toThrow(/not synthetic/);
    } finally {
      PATIENTS[0].email = original;
    }
    expect(fake.log).toEqual([]);
    expect(fake.objects.calls).toEqual([]);
  });

  it('no production-looking data in data/: every email in a seed data file is on example.com and no phone sits outside 555-01xx', () => {
    const dir = path.resolve(__dirname, 'data');
    const files = readdirSync(dir).filter((x) => x.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const text = readFileSync(path.join(dir, f), 'utf8');
      for (const email of text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []) expect(isSyntheticEmail(email), `${f}: ${email}`).toBe(true);
      for (const phone of text.match(/\+1[\d ()-]{9,}\d/g) ?? []) expect(isSyntheticPhone(phone), `${f}: a phone number`).toBe(true);
    }
  });
});

describe('seed:verify Messages check', () => {
  it('passes when Messages are disabled and fails (with the fix) when they are enabled', async () => {
    const ok = createFakeRoot();
    expect((await runVerify(ok.root, { search: false })).find((c) => /Messages are disabled/.test(c.name))?.ok).toBe(true);
    const on = createFakeRoot();
    const get = on.root.get.bind(on.root);
    on.root.get = (() => ({ execute: async () => ({ ...(await get().execute()), body: { key: on.projectKey, messages: { enabled: true } } }) })) as never;
    const failed = (await runVerify(on.root, { search: false })).find((c) => /Messages are disabled/.test(c.name));
    expect(failed?.ok).toBe(false);
    expect(failed?.detail).toMatch(/changeMessagesConfiguration/);
  });
});
