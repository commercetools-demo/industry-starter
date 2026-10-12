import * as fx from './__fixtures__/offers';
import { lintCatalog } from './lint';

const messages = (offers: Parameters<typeof lintCatalog>[0], level: 'error' | 'warning') =>
  lintCatalog(offers)
    .filter((finding) => finding.level === level)
    .map((finding) => `${finding.offerKey}: ${finding.message}`);

describe('lintCatalog', () => {
  it('the seed-shaped catalog has no errors', () => {
    expect(messages(fx.ALL_OFFERS, 'error')).toEqual([]);
  });

  it('flags an internet plan without downstream speed', () => {
    const broken = fx.withFacts(fx.cable100, { downstreamMbps: undefined });
    expect(messages([broken], 'error')).toEqual(expect.arrayContaining([expect.stringContaining('internet plan without downstream-mbps')]));
  });

  it('flags equipment without max speed or without technologies', () => {
    expect(messages([fx.withFacts(fx.routerAc1200, { maxDownstreamMbps: undefined })], 'error')).toEqual([expect.stringContaining('max-downstream-mbps')]);
    expect(messages([fx.withFacts(fx.routerAc1200, { supportedTechnologies: [] })], 'error')).toEqual([expect.stringContaining('supported-technologies')]);
  });

  it('flags an add-on without families', () => {
    expect(messages([fx.withFacts(fx.secure, { appliesToFamilies: [] })], 'error')).toEqual([expect.stringContaining('applies-to-families')]);
  });

  it('flags references that point at no offer, in every reference attribute', () => {
    const broken = {
      ...fx.cable500,
      includedOffers: ['malva-offer-ghost'],
      conflictsWith: ['malva-ghost'],
      compatibleAddons: ['malva-offer-ghost2'],
      compatibleEquipment: ['malva-offer-ghost3'],
    };
    const equipment = fx.withFacts(fx.routerAx3000, { incompatibleWith: ['malva-offer-ghost4'] });
    const errors = messages([broken, equipment], 'error');
    expect(errors).toHaveLength(5);
    expect(errors.join('\n')).toContain('incompatible-with refers to "malva-offer-ghost4"');
  });

  it('warns about a conflict declared on one side only', () => {
    const oneSided = { ...fx.cable100, conflictsWith: [] };
    const warnings = messages([oneSided, fx.cable500], 'warning');
    expect(warnings).toEqual(['malva-offer-cable-500: conflict with malva-offer-cable-100 is declared on this side only']);
  });

  it('errors when a plan requires a kind no offer in the catalog can satisfy, and accepts it when one can', () => {
    const installing = { ...fx.cable500, facts: { ...(fx.cable500.facts as object), requiredAddonKinds: ['installation'] } } as typeof fx.cable500;
    const kindErrors = (offers: Parameters<typeof lintCatalog>[0]) => messages(offers, 'error').filter((message) => message.includes('required-addon-kinds'));
    expect(kindErrors([installing])).toEqual([expect.stringContaining('"installation"')]);
    const installer = { ...fx.secure, facts: { ...(fx.secure.facts as object), addonKind: 'installation' } } as typeof fx.secure;
    expect(kindErrors([installing, installer])).toEqual([]);
  });

  it('flags requires-offers and negates-offers that point at no offer', () => {
    const broken = { ...fx.cable500, requiresOffers: ['malva-offer-ghost'], negatesOffers: ['malva-offer-ghost2'] };
    expect(messages([broken], 'error').filter((message) => /requires-offers|negates-offers/.test(message))).toHaveLength(2);
  });
});
