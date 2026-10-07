import * as fx from '@/lib/offers/__fixtures__/offers';
import type { CartLineRef, HeldService, Offer } from '@/lib/types';
import { dedupeVerdict, exclusivityVerdict, findConflicts, replacementPlan, revalidateExclusivity } from './exclusivity';

const byKey = fx.offersByKey();
const line = (lineItemId: string, offer: Offer, parentLineItemId?: string): CartLineRef => ({
  lineItemId,
  offerKey: offer.key,
  quantity: 1,
  ...(parentLineItemId ? { parentLineItemId } : {}),
});
const held = (offer: Offer, reference = 'MLV-DEMO-0001', source: HeldService['source'] = 'order'): HeldService => ({
  offerKey: offer.key,
  offerName: offer.name,
  source,
  reference,
});

describe('findConflicts', () => {
  it('names cart lines and held services, with who declared the conflict', () => {
    const findings = findConflicts(fx.wireless5g, [line('L1', fx.cable500), line('L2', fx.phoneUnlimited)], [held(fx.cable100)], byKey);
    expect(findings.map((finding) => [finding.source, finding.otherKey, finding.declaredBy])).toEqual([
      ['cart', 'malva-offer-cable-500', 'both'],
      ['held', 'malva-offer-cable-100', 'both'],
    ]);
    expect(findings[0].lineItemId).toBe('L1');
    expect(findings[1].reference).toBe('MLV-DEMO-0001');
  });

  it('never conflicts an offer with itself', () => {
    expect(findConflicts(fx.cable500, [line('L1', fx.cable500)], [held(fx.cable500)], byKey)).toEqual([]);
  });

  it('ignores cart lines and held services whose offer is not in the catalog', () => {
    expect(findConflicts(fx.cable500, [{ lineItemId: 'X', offerKey: 'malva-offer-gone', quantity: 1 }], [{ ...held(fx.cable100), offerKey: 'malva-offer-gone' }], byKey)).toEqual([]);
  });
});

describe('exclusivityVerdict', () => {
  it('Second conflicting offer refused: adding the wireless plan to a cart holding the cable plan is unavailable and names both offers', () => {
    const verdict = exclusivityVerdict(fx.wireless5g, [line('NET', fx.cable500)], [], byKey);
    expect(verdict.status).toBe('unavailable');
    expect(verdict.reasons).toHaveLength(1);
    expect(verdict.reasons[0]).toMatchObject({
      code: 'EXCLUSIVE_CONFLICT',
      messageKey: 'offers.reason.EXCLUSIVE_CONFLICT',
      params: { candidateName: 'Air 5G', otherName: 'Cable 500' },
      offerKeys: ['malva-offer-wireless-5g', 'malva-offer-cable-500'],
    });
  });

  it('Replacement offered as a choice: the verdict carries a replaces entry for the cart line and replacementPlan removes it with its dependents', () => {
    const cart = [line('NET', fx.cable500), line('SPOT', fx.spotify, 'NET'), line('MODEM', fx.modemDocsis31, 'NET'), line('PH', fx.phoneUnlimited)];
    const verdict = exclusivityVerdict(fx.wireless5g, cart, [], byKey);
    expect(verdict.replaces).toEqual([{ lineItemId: 'NET', offerKey: 'malva-offer-cable-500', offerName: 'Cable 500' }]);
    expect(replacementPlan(cart, 'NET')).toEqual({ removeIds: ['NET', 'SPOT', 'MODEM'] });
    expect(cart.map((entry) => entry.lineItemId)).toContain('PH'); // the unrelated phone plan stays
  });

  it('Conflict with a service already held: reported as HELD_SERVICE_CONFLICT against the held order, no replaces entry', () => {
    const verdict = exclusivityVerdict(fx.wireless5g, [], [held(fx.cable500, 'MLV-DEMO-0001')], byKey);
    expect(verdict.status).toBe('unavailable');
    expect(verdict.reasons).toEqual([
      expect.objectContaining({
        code: 'HELD_SERVICE_CONFLICT',
        messageKey: 'offers.reason.HELD_SERVICE_CONFLICT',
        params: { candidateName: 'Air 5G', otherName: 'Cable 500', reference: 'MLV-DEMO-0001' },
        offerKeys: ['malva-offer-wireless-5g', 'malva-offer-cable-500'],
      }),
    ]);
    expect(verdict.replaces).toBeUndefined();
  });

  it('Non conflicting offers coexist: two offers without a declared conflict give allowed and no reasons', () => {
    expect(exclusivityVerdict(fx.phoneUnlimited, [line('NET', fx.cable500)], [held(fx.cable100)], byKey)).toEqual({ status: 'allowed', reasons: [] });
  });

  it('Conflict is symmetric: declared on one offer only, detected in both add orders', () => {
    const left: Offer = { ...fx.phonePlus, conflictsWith: [fx.phoneEssential.key] };
    const right: Offer = { ...fx.phoneEssential, conflictsWith: [] };
    const map = { [left.key]: left, [right.key]: right };
    const forward = exclusivityVerdict(left, [line('B', right)], [], map);
    const backward = exclusivityVerdict(right, [line('A', left)], [], map);
    expect(forward.status).toBe('unavailable');
    expect(backward.status).toBe('unavailable');
    expect(findConflicts(left, [line('B', right)], [], map)[0].declaredBy).toBe('candidate');
    expect(findConflicts(right, [line('A', left)], [], map)[0].declaredBy).toBe('other');
    expect(backward.reasons[0].params).toEqual({ candidateName: 'Essential', otherName: 'Plus' });
  });

  it('has no override parameter: fixed arity and an extra argument changes nothing', () => {
    expect(exclusivityVerdict.length).toBe(4);
    expect(findConflicts.length).toBe(4);
    expect(revalidateExclusivity.length).toBe(3);
    const extra = exclusivityVerdict as (...args: unknown[]) => ReturnType<typeof exclusivityVerdict>;
    expect(extra(fx.wireless5g, [line('NET', fx.cable500)], [], byKey, { override: true }).status).toBe('unavailable');
  });
});

describe('revalidateExclusivity', () => {
  it('Conflict declared after the cart was built: revalidation flags the later line with a blocking replace issue naming both', () => {
    const early: Offer = { ...fx.phoneEssential, conflictsWith: [] };
    const late: Offer = { ...fx.phonePlus, conflictsWith: [] };
    const cart = [line('A', early), line('B', fx.cable500), line('C', late)];
    expect(revalidateExclusivity(cart, [], { ...byKey, [early.key]: early, [late.key]: late })).toEqual([]);
    const newlyDeclared = { ...byKey, [early.key]: early, [late.key]: { ...late, conflictsWith: [early.key] } };
    const issues = revalidateExclusivity(cart, [], newlyDeclared);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ lineItemId: 'C', offerKey: late.key, blocking: true, resolution: 'replace' });
    expect(issues[0].reasons[0]).toMatchObject({ code: 'EXCLUSIVE_CONFLICT', offerKeys: [late.key, early.key], params: { candidateName: 'Plus', otherName: 'Essential' } });
  });

  it('flags only the later line of a pair (cart order), one issue per line, and ignores a repeated offer', () => {
    const cart = [line('A', fx.cable500), line('B', fx.wireless5g), line('C', fx.cable500)];
    const issues = revalidateExclusivity(cart, [], byKey);
    expect(issues.map((issue) => issue.lineItemId)).toEqual(['B', 'C']);
    expect(issues[1].reasons.map((reason) => reason.offerKeys[1])).toEqual(['malva-offer-wireless-5g']);
  });

  it('flags a plan that conflicts with a held service as remove, and leaves add-ons alone', () => {
    const cart = [line('NET', fx.wireless5g), line('SPOT', fx.spotify, 'NET')];
    const issues = revalidateExclusivity(cart, [held(fx.cable500)], byKey);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ lineItemId: 'NET', resolution: 'remove', blocking: true });
    expect(issues[0].reasons[0].code).toBe('HELD_SERVICE_CONFLICT');
  });

  it('a clean cart gives no issues', () => {
    expect(revalidateExclusivity([line('NET', fx.cable500), line('PH', fx.phoneUnlimited)], [held(fx.phoneEssential)], byKey)).toEqual([]);
  });
});

describe('dedupeVerdict', () => {
  it('drops a repeated reason and replace target', () => {
    const verdict = exclusivityVerdict(fx.wireless5g, [line('NET', fx.cable500)], [], byKey);
    const doubled = { ...verdict, reasons: [...verdict.reasons, ...verdict.reasons], replaces: [...(verdict.replaces ?? []), ...(verdict.replaces ?? [])] };
    expect(dedupeVerdict(doubled)).toEqual(verdict);
    expect(dedupeVerdict({ status: 'allowed', reasons: [] })).toEqual({ status: 'allowed', reasons: [] });
  });
});
