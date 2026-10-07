import { cartLine } from '@/components/offers/__fixtures__/cart';
import {
  LISTED_APPLETV,
  LISTED_CABLE_500,
  LISTED_CABLE_GIG,
  LISTED_DEVICE_CARE,
  LISTED_PHONE_ESSENTIAL,
  LISTED_PLANS,
  LISTED_ROUTER_AC1200,
  LISTED_SPOTIFY,
} from './__fixtures__/catalog';
import { familyOf, resolveAddonCard } from './parent';

const PLANS = Object.fromEntries(LISTED_PLANS.map((plan) => [plan.key, plan]));
const cable = cartLine({ id: 'cable', offerKey: LISTED_CABLE_500.key, kind: 'plan' });
const phone = cartLine({ id: 'phone', offerKey: LISTED_PHONE_ESSENTIAL.key, kind: 'plan' });
const gig = cartLine({ id: 'gig', offerKey: LISTED_CABLE_GIG.key, kind: 'plan' });

describe('resolveAddonCard', () => {
  it('an empty bundle: needs a plan of the add-on\'s family', () => {
    expect(resolveAddonCard(LISTED_SPOTIFY, [], PLANS, null)).toEqual({ kind: 'needs-plan', family: 'internet' });
    expect(resolveAddonCard(LISTED_DEVICE_CARE, [], PLANS, null)).toEqual({ kind: 'needs-plan', family: 'phone' });
  });

  it('a plan of another family does not count: Apple TV+ (internet only) still needs a plan in a phone-only bundle', () => {
    expect(resolveAddonCard(LISTED_APPLETV, [phone], PLANS, null)).toEqual({ kind: 'needs-plan', family: 'internet' });
  });

  it('Same add on different offer: the first compatible plan in bundle order is the parent', () => {
    expect(resolveAddonCard(LISTED_SPOTIFY, [phone, cable], PLANS, null)).toMatchObject({ kind: 'ready', parent: { id: 'phone' } });
    expect(resolveAddonCard(LISTED_SPOTIFY, [cable, phone], PLANS, null)).toMatchObject({ kind: 'ready', parent: { id: 'cable' } });
  });

  it('the plan named by ?for= wins when it qualifies, otherwise the first one does', () => {
    expect(resolveAddonCard(LISTED_SPOTIFY, [cable, phone], PLANS, 'phone')).toMatchObject({ kind: 'ready', parent: { id: 'phone' } });
    expect(resolveAddonCard(LISTED_APPLETV, [cable, phone], PLANS, 'phone')).toMatchObject({ kind: 'ready', parent: { id: 'cable' } });
  });

  it('an add-on already in the bundle is "added" with its line', () => {
    const line = cartLine({ id: 'sp', offerKey: LISTED_SPOTIFY.key, kind: 'addon', parentLineId: 'cable' });
    expect(resolveAddonCard(LISTED_SPOTIFY, [cable, line], PLANS, null)).toEqual({ kind: 'added', line });
  });

  it('every fitting plan includes it: "included"', () => {
    expect(resolveAddonCard(LISTED_APPLETV, [gig], PLANS, null)).toEqual({ kind: 'included' });
  });

  it('a plan is there but the rules refuse: the reason is carried (never an override)', () => {
    const state = resolveAddonCard(LISTED_ROUTER_AC1200, [cable], PLANS, null);
    expect(state).toMatchObject({ kind: 'unavailable', reason: { code: 'SPEED_TOO_LOW' } });
  });

  it('a plan line whose offer is not known is ignored', () => {
    const unknown = cartLine({ id: 'x', offerKey: 'malva-offer-gone', kind: 'plan' });
    expect(resolveAddonCard(LISTED_SPOTIFY, [unknown], PLANS, null).kind).toBe('needs-plan');
  });
});

describe('familyOf', () => {
  it('phone-only add-ons are phone, everything else internet', () => {
    expect(familyOf(LISTED_DEVICE_CARE)).toBe('phone');
    expect(familyOf(LISTED_SPOTIFY)).toBe('internet');
    expect(familyOf(LISTED_ROUTER_AC1200)).toBe('internet');
  });
});
