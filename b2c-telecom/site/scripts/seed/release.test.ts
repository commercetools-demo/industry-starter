// @vitest-environment node
import { EXIT } from './config';
import { main, COMMANDS, type ReleaseDeps } from './release';
import { NOW, RELEASE_AT, makeProject } from './release/fixture';
import { getRecord } from './release/store';
import type { FakeCt } from './test/fake-ct';

const SOURCE = { CTP_SEED_PROJECT_KEY: 'spec-test-b2c-telecom' };
const CONFIRM = ['--confirm-project', 'spec-test-b2c-telecom'];
const EXAMPLE = 'malva-rel-example-summer-unlimited';

function run(fake: FakeCt, argv: string[], over: Partial<ReleaseDeps> = {}): Promise<{ code: number; text: string; files: Record<string, string> }> {
  const lines: string[] = [];
  const files: Record<string, string> = {};
  return main(argv, { api: fake, source: SOURCE, log: (l) => void lines.push(l), now: () => NOW, writeState: () => undefined, writeFile: (f, t) => void (files[f] = t), ...over }).then((code) => ({ code, text: lines.join('\n'), files }));
}

describe('release CLI', () => {
  it('dispatches the seven commands and refuses an unknown one', async () => {
    expect([...COMMANDS]).toEqual(['validate', 'preview', 'apply', 'cancel', 'rollback', 'history', 'verify']);
    const fake = await makeProject();
    const unknown = await run(fake, ['publish', EXAMPLE]);
    expect(unknown.code).toBe(EXIT.FAILED);
    expect(unknown.text).toContain('Usage');
    expect((await run(fake, ['validate'])).code).toBe(EXIT.FAILED);
  });

  it('validate prints OK for the example and DANGLING_KEY with exit 3 for the broken one', async () => {
    const fake = await makeProject();
    const ok = await run(fake, ['validate', EXAMPLE, '--release-at', RELEASE_AT]);
    expect(ok.code).toBe(EXIT.OK);
    expect(ok.text).toContain('OK');
    const broken = await run(fake, ['validate', 'malva-rel-example-broken', '--release-at', RELEASE_AT]);
    expect(broken.code).toBe(EXIT.PREFLIGHT);
    expect(broken.text).toContain('DANGLING_KEY malva-offer-nope');
    expect(fake.writes).toBe(0);
  });

  it('refuses a missing manifest and a bad --release-at without touching the project', async () => {
    const fake = await makeProject();
    const missing = await run(fake, ['validate', 'malva-rel-nothing-here']);
    expect(missing.code).toBe(EXIT.PREFLIGHT);
    const bad = await run(fake, ['validate', EXAMPLE, '--release-at', 'tomorrow']);
    expect(bad.code).toBe(EXIT.PREFLIGHT);
    expect(fake.writes).toBe(0);
  });

  it('preview prints the table, the diff and the checklist and writes nothing', async () => {
    const fake = await makeProject();
    const out = await run(fake, ['preview', EXAMPLE, '--release-at', RELEASE_AT]);
    expect(out.code).toBe(EXIT.OK);
    expect(out.text).toContain('malva-offer-phone-unlimited-summer');
    expect(out.text).toContain('offers withdrawn: malva-offer-phone-online-only');
    expect(out.text).toContain('Summer campaign banner');
    expect(fake.writes).toBe(0);
  });

  it('a write command without --confirm-project, or against another project, is refused with exit 2 before any write', async () => {
    const fake = await makeProject();
    const noConfirm = await run(fake, ['apply', EXAMPLE, '--release-at', RELEASE_AT, '--ack']);
    expect(noConfirm.code).toBe(EXIT.TARGET_REFUSED);
    const wrong = await run(fake, ['apply', EXAMPLE, '--release-at', RELEASE_AT, '--ack', '--confirm-project', 'someone-else']);
    expect(wrong.code).toBe(EXIT.TARGET_REFUSED);
    const otherProject = await run(fake, ['cancel', EXAMPLE, '--confirm-project', 'other'], { source: { CTP_SEED_PROJECT_KEY: 'other' } });
    expect(otherProject.code).toBe(EXIT.TARGET_REFUSED);
    expect(fake.writes).toBe(0);
  });

  it('--fail-after needs a number and --confirm-project', async () => {
    const fake = await makeProject();
    expect((await run(fake, ['apply', EXAMPLE, '--fail-after', '2'])).code).toBe(EXIT.FAILED);
    expect((await run(fake, ['apply', EXAMPLE, '--fail-after', 'x', ...CONFIRM])).code).toBe(EXIT.FAILED);
    expect(fake.writes).toBe(0);
  });

  it('apply, history, verify, cancel and rollback end to end on the fake', async () => {
    const fake = await makeProject();
    const applied = await run(fake, ['apply', EXAMPLE, '--release-at', RELEASE_AT, '--ack', '--operator', 'claude', ...CONFIRM]);
    expect(applied.code).toBe(EXIT.OK);
    expect(applied.text).toContain(`scheduled for ${RELEASE_AT}`);
    expect((await getRecord(fake, EXAMPLE))?.appliedBy).toBe('claude');

    const history = await run(fake, ['history', '--at', '2026-10-07T12:00:00Z']);
    expect(history.text).toContain(EXAMPLE);
    expect(history.text).toContain('appliedBy "claude"');

    expect((await run(fake, ['verify', EXAMPLE])).code).toBe(EXIT.OK);

    // rollback before the release instant is refused and points to cancel
    const early = await run(fake, ['rollback', EXAMPLE]);
    expect(early.code).toBe(EXIT.PREFLIGHT);
    expect(early.text).toContain('release:cancel');

    // after the instant it writes the inverse manifest (and writes nothing to the project)
    const writes = fake.writes;
    const late = await run(fake, ['rollback', EXAMPLE, '--expedite', 'Wrong price in the summer campaign'], { now: () => new Date(Date.parse(RELEASE_AT) + 60 * 1000) });
    expect(late.code).toBe(EXIT.OK);
    expect(Object.keys(late.files)[0]).toContain(`${EXAMPLE}-rollback.release.json`);
    const manifest = JSON.parse(Object.values(late.files)[0]) as { rollbackOf: string; expedite: { reason: string }; withdrawOffers: string[] };
    expect(manifest.rollbackOf).toBe(EXAMPLE);
    expect(manifest.expedite.reason).toBe('Wrong price in the summer campaign');
    expect(manifest.withdrawOffers).toEqual(['malva-offer-phone-unlimited-summer']);
    expect(fake.writes).toBe(writes);

    // cancel after the instant is refused
    expect((await run(fake, ['cancel', EXAMPLE, ...CONFIRM], { now: () => new Date(Date.parse(RELEASE_AT) + 60 * 1000) })).code).toBe(EXIT.PREFLIGHT);
  });

  it('verify exits 3 when a key the release references was deleted', async () => {
    const fake = await makeProject();
    await run(fake, ['apply', EXAMPLE, '--release-at', RELEASE_AT, '--ack', ...CONFIRM]);
    const spotify = fake.byKey('products', 'malva-offer-spotify');
    expect(spotify).toBeDefined();
    await fake.post('products/key=malva-offer-spotify', { version: (spotify as { version: number }).version, actions: [{ action: 'unpublish' }] });
    const stored = fake.byKey('products', 'malva-offer-spotify') as { version: number };
    await fake.del('products/key=malva-offer-spotify', { version: stored.version });
    const out = await run(fake, ['verify', EXAMPLE]);
    expect(out.code).toBe(EXIT.PREFLIGHT);
    expect(out.text).toContain('DANGLING_KEY malva-offer-spotify');
  });

  it('apply with --fail-after 2 exits 1, restores the project and a second apply succeeds', async () => {
    const fake = await makeProject();
    const failed = await run(fake, ['apply', EXAMPLE, '--release-at', RELEASE_AT, '--ack', '--fail-after', '2', ...CONFIRM]);
    expect(failed.code).toBe(EXIT.FAILED);
    expect((await getRecord(fake, EXAMPLE))?.status).toBe('rolled-back');
    expect(fake.byKey('products', 'malva-offer-phone-unlimited-summer')).toBeUndefined();
    expect(fake.byKey('cart-discounts', 'malva-cd-rel-example-5-off')).toBeUndefined();
    const again = await run(fake, ['apply', EXAMPLE, '--release-at', RELEASE_AT, '--ack', ...CONFIRM]);
    expect(again.code).toBe(EXIT.OK);
  });

  it('apply refuses an expired release instant with exit 3', async () => {
    const fake = await makeProject();
    const out = await run(fake, ['apply', EXAMPLE, '--release-at', '2026-10-07T10:05:00Z', '--ack', ...CONFIRM]);
    expect(out.code).toBe(EXIT.PREFLIGHT);
    expect(out.text).toContain('LEAD_TIME');
    expect(fake.writes).toBe(0);
  });
});
