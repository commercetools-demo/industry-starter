// Copilot action of workstream T (T-11): "Pause the Brake season promo" / "Turn on the Brake season promo". The rule match only reads
// the sentence; the discount is looked up when the user pressed Confirm, in the signed-in store only. The change goes through the
// same service as the Active toggle, after `authorizeStore`. Ambiguous names answer with the matching names, Malva-funded ones are refused.
import 'server-only';
import { authorizeStore } from '@/lib/authz/authorize-store';
import { setDiscountActive, listDiscounts } from '@/lib/ct/seller/discounts';
import { CatalogError } from '@/lib/catalog/errors';
import type { DiscountKind } from '@/lib/catalog/types';
import { registerCopilotAction } from './copilot';

const PATTERN = /^\s*(pause|deactivate|turn off|activate|turn on)(?:\s+the)?\s+(.+?)\s*\.?\s*$/i;
const OFF = new Set(['pause', 'deactivate', 'turn off']);
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export const LOCKED_MESSAGE = 'This discount is funded by Malva and cannot be changed here.';

/** The id and the new state travel as params, so Confirm acts on exactly what the panel described. */
registerCopilotAction({
  id: 'set-discount-active',
  permission: 'discount.edit',
  match(text) {
    const m = PATTERN.exec(text);
    if (!m) return null;
    return { params: { name: m[2], active: OFF.has(m[1].toLowerCase()) ? 'false' : 'true' } };
  },
  describe: (params) => `Set '${params.name}' to ${params.active === 'true' ? 'active' : 'inactive'}`,
  async apply(session, params) {
    const storeKey = session.storeKey ?? '';
    await authorizeStore(session, storeKey, 'discount.edit');
    const wanted = fold(params.name ?? '');
    const kinds: DiscountKind[] = ['product', 'cart'];
    const found = (
      await Promise.all(kinds.map(async (kind) => (await listDiscounts(storeKey, kind)).map((d) => ({ d, kind }))))
    )
      .flat()
      .filter(({ d }) => Object.values(d.name).some((n) => fold(n) === wanted));
    if (found.length === 0) return { ok: false, message: `No discount named '${params.name}' in your store.` };
    if (found.length > 1) {
      const names = [...new Set(found.map(({ d, kind }) => `${Object.values(d.name)[0]} (${kind})`))].join(', ');
      return { ok: false, message: `More than one discount matches: ${names}. Use the exact name.` };
    }
    const { d, kind } = found[0];
    if (d.funded === 'malva') return { ok: false, message: LOCKED_MESSAGE };
    const active = params.active === 'true';
    try {
      await setDiscountActive(storeKey, kind, d.id, active);
    } catch (error) {
      if (error instanceof CatalogError) return { ok: false, message: error.message };
      throw error;
    }
    return { ok: true, message: `'${params.name}' is now ${active ? 'active' : 'inactive'}.` };
  },
});
