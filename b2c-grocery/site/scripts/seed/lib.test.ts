// @vitest-environment node
import { ensureResource, pickDiff, runSteps } from './lib';

describe('ensureResource', () => {
  it('Existing matching resource: reports ok and does not create', async () => {
    const create = vi.fn();
    const r = await ensureResource({ find: async () => ({ a: 1 }), create, diff: () => null });
    expect(r).toBe('ok');
    expect(create).not.toHaveBeenCalled();
  });

  it('missing resource is created', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    expect(await ensureResource({ find: async () => null, create, diff: () => null })).toBe('created');
    expect(create).toHaveBeenCalledOnce();
  });

  it('Differing resource: returns the difference and does not create', async () => {
    const create = vi.fn();
    const r = await ensureResource({ find: async () => ({}), create, diff: () => 'attribute x differs' });
    expect(r).toEqual({ diff: 'attribute x differs' });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('pickDiff', () => {
  it('detects a differing key and ignores unlisted keys', () => {
    expect(pickDiff('c', { name: { a: 1 }, x: 1 }, { name: { a: 1 }, x: 2 }, ['name'])).toBeNull();
    expect(pickDiff('c', { name: { a: 1 } }, { name: { a: 2 } }, ['name'])).toContain('"name" differs');
  });
});

describe('runSteps', () => {
  it('Differing resource: stops at the first diff and runs nothing after it', async () => {
    const after = vi.fn();
    const log = vi.fn();
    const ok = await runSteps(
      [
        { name: 'one', run: async () => 'created' },
        { name: 'two', run: async () => ({ diff: 'boom' }) },
        { name: 'three', run: after },
      ],
      log,
    );
    expect(ok).toBe(false);
    expect(after).not.toHaveBeenCalled();
    expect(log).toHaveBeenLastCalledWith('STOP  two: boom');
  });

  it('returns true when every step is ok or created', async () => {
    expect(await runSteps([{ name: 'a', run: async () => 'ok' }], () => {})).toBe(true);
  });
});
