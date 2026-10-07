import { describe, expect, it } from 'vitest';
import type { AttributeDefinitionDraft, ProductTypeDraft } from '../../types';
import { productTypes, addonType, deviceType, equipmentType, internetPlanType, offerType, phonePlanType } from '.';

const find = (type: ProductTypeDraft, name: string): AttributeDefinitionDraft => {
  const def = type.attributes.find((a) => a.name === name);
  if (!def) throw new Error(`${type.key} has no attribute ${name}`);
  return def;
};
const typeName = (def: AttributeDefinitionDraft): string => (def.type.name === 'set' ? `set<${def.type.elementType.name}>` : def.type.name);

describe('product types', () => {
  it('six types with the plan keys and every attribute at Variant level', () => {
    expect(productTypes.map((t) => t.key)).toEqual(['malva-internet-plan', 'malva-phone-plan', 'malva-addon', 'malva-equipment', 'malva-device', 'malva-offer']);
    for (const type of productTypes) for (const a of type.attributes) expect(a.level).toBe('Variant');
  });

  it('Internet plan described by typed attributes: technology, speeds and term are typed and numeric', () => {
    expect(typeName(find(internetPlanType, 'technology'))).toBe('lenum');
    expect(typeName(find(internetPlanType, 'downstream-mbps'))).toBe('number');
    expect(typeName(find(internetPlanType, 'upstream-mbps'))).toBe('number');
    expect(typeName(find(internetPlanType, 'contract-term'))).toBe('lenum');
    expect(find(internetPlanType, 'contract-term').attributeConstraint).toBe('None');
    expect(find(internetPlanType, 'technology').attributeConstraint).toBe('SameForAll');
  });

  it('Equipment declares what it can carry: max speed and technologies are attributes', () => {
    expect(typeName(find(equipmentType, 'max-downstream-mbps'))).toBe('number');
    expect(typeName(find(equipmentType, 'supported-technologies'))).toBe('set<enum>');
    expect(typeName(find(equipmentType, 'equipment-kind'))).toBe('enum');
    expect(typeName(find(equipmentType, 'incompatible-with'))).toBe('set<text>');
  });

  it('Add-on declares where it applies: families and charge type are attributes', () => {
    expect(typeName(find(addonType, 'applies-to-families'))).toBe('set<enum>');
    expect(typeName(find(addonType, 'charge-type'))).toBe('lenum');
    expect(typeName(find(addonType, 'addon-tag'))).toBe('lenum');
    expect(typeName(find(addonType, 'addon-kind'))).toBe('lenum');
  });

  it('Sellable offer separate from the thing sold: audience, channel, start time and relations live on the offer', () => {
    for (const name of ['audience', 'channels', 'start-time', 'end-time', 'included-offers', 'conflicts-with', 'compatible-addons', 'compatible-equipment', 'existing-customer', 'anchors']) {
      expect(offerType.attributes.map((a) => a.name)).toContain(name);
    }
    expect(typeName(find(offerType, 'start-time'))).toBe('datetime');
    expect(typeName(find(offerType, 'end-time'))).toBe('datetime');
    expect(typeName(find(offerType, 'channels'))).toBe('set<text>');
    expect(find(offerType, 'offer-kind').savedToLineItem).toBe(true);
    expect(find(offerType, 'offer-family').savedToLineItem).toBe(true);
    expect(find(offerType, 'intro-free-months').savedToLineItem).toBe(true);
    const saved = offerType.attributes.filter((a) => a.savedToLineItem).map((a) => a.name);
    expect(saved).toEqual(['offer-kind', 'offer-family', 'intro-free-months']);
  });

  it('Plan carries the facts the storefront shows: every card and label fact is a typed attribute', () => {
    const facts: Record<string, string> = {
      'typical-download-mbps': 'number',
      'typical-upload-mbps': 'number',
      'typical-latency-ms': 'number',
      'data-gb': 'number',
      'price-lock-months': 'number',
      'activation-fee': 'number',
      'early-termination-fee': 'ltext',
      'label-plan-id': 'text',
      badge: 'lenum',
      'bundle-discount-text': 'ltext',
      highlights: 'set<ltext>',
      'included-addons': 'set<text>',
    };
    for (const type of [internetPlanType, phonePlanType]) {
      for (const [name, expected] of Object.entries(facts)) expect(typeName(find(type, name)), `${type.key}.${name}`).toBe(expected);
    }
    expect(typeName(find(phonePlanType, 'lines-included'))).toBe('number');
    expect(typeName(find(phonePlanType, 'hotspot-gb'))).toBe('number');
    expect(find(phonePlanType, 'network-generation').isRequired).toBe(true);
  });

  it('Handset type has color and memory as variant attributes and no acquisition attribute', () => {
    expect(deviceType.attributes.map((a) => a.name)).toEqual(['brand', 'color', 'memory-gb', 'os', 'network-generation', 'compatible-plan-families', 'highlights']);
    expect(find(deviceType, 'color').attributeConstraint).toBe('None');
    expect(find(deviceType, 'memory-gb').attributeConstraint).toBe('None');
  });

  it('descriptive types are not searched on denormalised copies and stay far below the 50 attribute limit', () => {
    for (const type of productTypes) expect(type.attributes.length).toBeLessThan(50);
    for (const name of ['anchors', 'included-offers', 'compatible-addons', 'compatible-equipment', 'price-steps']) {
      expect(find(offerType, name).isSearchable).toBe(false);
    }
  });
});
