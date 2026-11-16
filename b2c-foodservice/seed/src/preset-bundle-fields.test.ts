// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { describe, expect, it } from 'vitest';
import { typeDrafts } from './data/custom-types';
import { planTypeUpdate } from './sync';

/** Workstream V-02: the bundle fields on the line custom type are added, never changed. */
const BUNDLE_FIELDS = ['parentId', 'bundlePreset', 'bundleMachineSku', 'bundleDiscount', 'bundleWasCents'];
const line = typeDrafts.find((t) => t.key === 'mcf-line-fulfilment') as unknown as {
  fieldDefinitions: { name: string; label: unknown; type: { name: string } }[];
};
const addedNames = (actions: unknown[]) =>
  actions
    .filter((a) => (a as { action: string }).action === 'addFieldDefinition')
    .map((a) => (a as { fieldDefinition: { name: string } }).fieldDefinition.name);

describe('mcf-line-fulfilment bundle fields (V-02)', () => {
  it('missing bundle fields are added', () => {
    const existing = { fieldDefinitions: line.fieldDefinitions.filter((f) => !BUNDLE_FIELDS.includes(f.name)) };
    expect(addedNames(planTypeUpdate(existing as never, line as never)).sort()).toEqual([...BUNDLE_FIELDS].sort());
  });

  it('an existing parentId is left alone (the owner added it in Merchant Center)', () => {
    const ownerParentId = { name: 'parentId', label: { 'en-US': 'Owner parent id' }, type: { name: 'String' } };
    const existing = {
      fieldDefinitions: [
        ...line.fieldDefinitions.filter((f) => !BUNDLE_FIELDS.includes(f.name)),
        ownerParentId,
      ],
    };
    const added = addedNames(planTypeUpdate(existing as never, line as never));
    expect(added).not.toContain('parentId');
    expect(added.sort()).toEqual(['bundleDiscount', 'bundleMachineSku', 'bundlePreset', 'bundleWasCents']);
  });

  it('a second run plans no actions', () => {
    expect(planTypeUpdate({ fieldDefinitions: line.fieldDefinitions } as never, line as never)).toEqual([]);
  });
});
