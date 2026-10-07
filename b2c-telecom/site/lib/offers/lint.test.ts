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

  it('warns that required-addon-kinds installation is ignored', () => {
    const installing = { ...fx.cable500, facts: { ...(fx.cable500.facts as object), requiredAddonKinds: ['installation'] } } as typeof fx.cable500;
    expect(messages([installing], 'warning')).toEqual([expect.stringContaining('installation')]);
  });
});
