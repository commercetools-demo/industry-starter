import {
  LISTED_ADDONS,
  LISTED_APPLETV,
  LISTED_CABLE_500,
  LISTED_CABLE_GIG,
  LISTED_DEVICE_CARE,
  LISTED_EQUIPMENT,
  LISTED_MESH,
  LISTED_PHONE_UNLIMITED,
  LISTED_ROUTER_AC1200,
  LISTED_ROUTER_AX3000,
  LISTED_SPOTIFY,
} from '@/lib/listing/__fixtures__/catalog';
import { cartLine } from './__fixtures__/cart';
import { computeAddonChoices, computeEquipmentChoices, equipmentVariants } from './choices';

const stateOf = (choices: { offer: { key: string }; state: string }[], key: string): string | undefined => choices.find((choice) => choice.offer.key === key)?.state;

describe('computeAddonChoices', () => {
  it('a phone-only add-on is not listed on an internet card', () => {
    const choices = computeAddonChoices(LISTED_CABLE_500, LISTED_ADDONS, []);
    expect(choices.map((choice) => choice.offer.key)).not.toContain(LISTED_DEVICE_CARE.key);
    expect(choices.map((choice) => choice.offer.key)).toContain(LISTED_SPOTIFY.key);
  });

  it('a phone card does not list internet-only add-ons', () => {
    const keys = computeAddonChoices(LISTED_PHONE_UNLIMITED, LISTED_ADDONS, []).map((choice) => choice.offer.key);
    expect(keys).toContain(LISTED_DEVICE_CARE.key);
    expect(keys).not.toContain(LISTED_APPLETV.key);
  });

  it('an add-on the plan includes is "included"', () => {
    expect(stateOf(computeAddonChoices(LISTED_CABLE_GIG, LISTED_ADDONS, []), LISTED_APPLETV.key)).toBe('included');
    expect(stateOf(computeAddonChoices(LISTED_CABLE_500, LISTED_ADDONS, []), LISTED_APPLETV.key)).toBe('selectable');
  });

  it('an add-on already on the plan is "attached" with its line', () => {
    const line = cartLine({ id: 'sp', offerKey: LISTED_SPOTIFY.key, kind: 'addon', parentLineId: 'plan' });
    const choice = computeAddonChoices(LISTED_CABLE_500, LISTED_ADDONS, [line]).find((entry) => entry.offer.key === LISTED_SPOTIFY.key);
    expect(choice).toMatchObject({ state: 'attached', attachedLine: line });
  });
});

describe('computeEquipmentChoices', () => {
  it('Equipment too slow for the plan: a speed reason, shown disabled and never hidden', () => {
    const groups = computeEquipmentChoices(LISTED_CABLE_500, LISTED_EQUIPMENT, []);
    const router = groups.find((group) => group.kind === 'router');
    const slow = router?.choices.find((choice) => choice.offer.key === LISTED_ROUTER_AC1200.key);
    expect(slow?.state).toBe('disabled');
    expect(slow?.reason?.code).toBe('SPEED_TOO_LOW');
    expect(router?.choices.find((choice) => choice.offer.key === LISTED_ROUTER_AX3000.key)?.state).toBe('selectable');
    expect(router?.choices.find((choice) => choice.offer.key === LISTED_MESH.key)?.state).toBe('selectable');
  });

  it('equipment of the wrong technology is disabled with its reason; included kinds are included', () => {
    const groups = computeEquipmentChoices(LISTED_CABLE_500, LISTED_EQUIPMENT, []);
    expect(groups.find((group) => group.kind === 'gateway')?.choices[0]).toMatchObject({ state: 'disabled', reason: { code: 'TECHNOLOGY_MISMATCH' } });
    expect(groups.find((group) => group.kind === 'modem')?.choices[0].state).toBe('included');
  });

  it('variants: rental before purchase, both with their price', () => {
    expect(equipmentVariants(LISTED_ROUTER_AX3000)).toEqual([
      { sku: 'MLV-EQP-ROUTER-AX3000-RENT', mode: 'rental', price: { centAmount: 800, currencyCode: 'USD' } },
      { sku: 'MLV-EQP-ROUTER-AX3000-BUY', mode: 'purchase', price: { centAmount: 12999, currencyCode: 'USD' } },
    ]);
  });

  it('the attached equipment marks its variant', () => {
    const line = cartLine({ id: 'eq', offerKey: LISTED_ROUTER_AX3000.key, kind: 'equipment', sku: 'MLV-EQP-ROUTER-AX3000-BUY', parentLineId: 'plan' });
    const router = computeEquipmentChoices(LISTED_CABLE_500, LISTED_EQUIPMENT, [line]).find((group) => group.kind === 'router');
    expect(router?.choices.find((choice) => choice.offer.key === LISTED_ROUTER_AX3000.key)).toMatchObject({ state: 'attached', attachedLine: line });
  });
});
