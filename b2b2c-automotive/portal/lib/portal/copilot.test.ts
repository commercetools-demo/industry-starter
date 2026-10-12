import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyConfirmed, plan, registerCopilotAction, resetCopilotActions, type CopilotAction } from './copilot';

const admin = { roles: ['admin' as const], ctPermissions: [] };
const buyer = { roles: ['buyer' as const], ctPermissions: [] };
const session = { customerId: 'c1', storeKey: 's1' };

const apply = vi.fn(async () => ({ ok: true, message: "'Brake season promo' is now inactive" }));
const pause: CopilotAction = {
  id: 'test-pause-discount',
  match: (text) => {
    const m = /^pause the (.+)$/i.exec(text.trim());
    return m ? { params: { name: m[1] } } : null;
  },
  describe: (p) => `Set '${p.name}' to inactive`,
  apply,
  permission: 'discount.edit',
};

beforeEach(() => {
  resetCopilotActions();
  apply.mockClear();
  registerCopilotAction(pause);
});

describe('copilot', () => {
  it('plan returns confirm, apply not called until confirm', async () => {
    const result = plan('Pause the Brake season promo', session, admin);
    expect(result).toEqual({
      kind: 'confirm',
      actionId: 'test-pause-discount',
      params: { name: 'Brake season promo' },
      summary: "Set 'Brake season promo' to inactive",
    });
    expect(apply).not.toHaveBeenCalled();
    const done = await applyConfirmed('test-pause-discount', { name: 'Brake season promo' }, session, admin);
    expect(done).toEqual({ ok: true, message: "'Brake season promo' is now inactive" });
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('buyer without permission gets refusal text', async () => {
    const result = plan('Pause the Brake season promo', session, buyer);
    expect(result.kind).toBe('answer');
    expect((result as { text: string }).text).toContain('Insufficient permissions to perform this task');
    // and the apply endpoint re-checks even when the plan step was skipped
    const direct = await applyConfirmed('test-pause-discount', { name: 'x' }, session, buyer);
    expect(direct.ok).toBe(false);
    expect(apply).not.toHaveBeenCalled();
  });

  it('an unknown action id is refused', async () => {
    expect((await applyConfirmed('nope', {}, session, admin)).ok).toBe(false);
  });

  it('a throwing action reports a failure without leaking details', async () => {
    apply.mockRejectedValueOnce(new Error('secret detail'));
    const res = await applyConfirmed('test-pause-discount', { name: 'x' }, session, admin);
    expect(res.ok).toBe(false);
    expect(res.message).not.toContain('secret detail');
  });

  it('where is X answers with the page link, in the active language', () => {
    const en = plan('Where is Returns?', session, admin);
    expect(en).toMatchObject({ kind: 'answer', href: '/returns' });
    const de = plan('Wo ist Retouren?', session, admin, 'de-DE');
    expect(de).toMatchObject({ kind: 'answer', href: '/returns' });
  });

  it('where is a page the role cannot open falls back to the generic answer', () => {
    const res = plan('Where is Brand partnership?', session, buyer);
    expect(res).toMatchObject({ kind: 'answer' });
    expect((res as { href?: string }).href).toBeUndefined();
  });

  it('anything else falls back to the generic answer', () => {
    expect(plan('tell me a joke', session, admin)).toMatchObject({ kind: 'answer' });
  });
});
