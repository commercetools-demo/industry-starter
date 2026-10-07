import type { Offer } from '@/lib/types';
import { refersTo } from './refs';

export interface LintFinding {
  level: 'error' | 'warning';
  offerKey: string;
  message: string;
}

/** Data lint for the rule inputs. Errors are what makes the rules fail closed; warnings are data that should be fixed. Pure. */
export function lintCatalog(offers: Offer[]): LintFinding[] {
  const findings: LintFinding[] = [];
  const add = (level: LintFinding['level'], offer: Offer, message: string) => findings.push({ level, offerKey: offer.key, message });

  for (const offer of offers) {
    const facts = offer.facts;
    if (facts?.kind === 'plan') {
      if (facts.family === 'internet' && facts.downstreamMbps === undefined) add('error', offer, 'internet plan without downstream-mbps');
      if (facts.requiredAddonKinds.includes('installation')) add('warning', offer, 'required-addon-kinds contains "installation": no such add-on type exists, it is ignored');
    }
    if (facts?.kind === 'equipment') {
      if (facts.maxDownstreamMbps === undefined) add('error', offer, 'equipment without max-downstream-mbps');
      if (facts.supportedTechnologies.length === 0) add('error', offer, 'equipment with empty supported-technologies');
    }
    if (facts?.kind === 'addon' && facts.appliesToFamilies.length === 0) add('error', offer, 'add-on with empty applies-to-families');

    const references: [string, string[]][] = [
      ['included-offers', offer.includedOffers],
      ['conflicts-with', offer.conflictsWith],
      ['compatible-addons', offer.compatibleAddons],
      ['compatible-equipment', offer.compatibleEquipment],
      ['incompatible-with', facts?.kind === 'equipment' ? facts.incompatibleWith : []],
    ];
    for (const [attribute, refs] of references) {
      for (const ref of refs) {
        if (!offers.some((other) => refersTo(ref, other))) add('error', offer, `${attribute} refers to "${ref}", which is no offer in the catalog`);
      }
    }

    for (const ref of offer.conflictsWith) {
      const other = offers.find((candidate) => candidate.key !== offer.key && refersTo(ref, candidate));
      if (other && !other.conflictsWith.some((back) => refersTo(back, offer))) {
        add('warning', offer, `conflict with ${other.key} is declared on this side only`);
      }
    }
  }
  return findings;
}
