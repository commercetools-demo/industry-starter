import { describe, expect, it } from 'vitest';
import { chunk, retryOnConflict } from './versioned';

const conflict = () => Object.assign(new Error('conflict'), { statusCode: 409 });

describe('versioned helpers', () => {
  it('chunks 230 actions into 100, 100 and 30', () => {
    expect(chunk(Array.from({ length: 230 }, (_, i) => i), 100).map((c) => c.length)).toEqual([100, 100, 30]);
  });

  it('retries only on a 409 and gives up after the limit', async () => {
    let n = 0;
    await expect(
      retryOnConflict(async () => {
        n += 1;
        if (n < 3) throw conflict();
        return 'ok';
      }),
    ).resolves.toBe('ok');
    await expect(retryOnConflict(async () => { throw Object.assign(new Error('bad'), { statusCode: 400 }); })).rejects.toThrow('bad');
    let tries = 0;
    await expect(retryOnConflict(async () => { tries += 1; throw conflict(); }, 3)).rejects.toThrow('conflict');
    expect(tries).toBe(3);
  });
});
