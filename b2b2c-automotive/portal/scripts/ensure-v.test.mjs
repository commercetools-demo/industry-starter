/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { describe, expect, it } from 'vitest';
import { reviewStateDrafts, reviewTypeDraft, SEED_FIELDS, typeProblems } from './ensure-v.mjs';

const type = (names) => ({ fieldDefinitions: names.map((name) => ({ name })) });

describe('ensure-v', () => {
  it('verifies the four seed types and creates none of them, nor an order audit or consent type', () => {
    expect(Object.keys(SEED_FIELDS)).toEqual(['malva-checkout', 'malva-line', 'malva-return-item', 'malva-customer']);
    expect(JSON.stringify(Object.keys(SEED_FIELDS))).not.toMatch(/consent|audit|review/);
  });
  it('reports a missing type and missing fields', () => {
    expect(typeProblems('malva-line', undefined)[0]).toMatch(/missing/);
    expect(typeProblems('malva-return-item', type(SEED_FIELDS['malva-return-item']))).toEqual([]);
    expect(typeProblems('malva-return-item', type(['returnNumber', 'status']))).toContain('custom type malva-return-item has no field refundRequestedAt');
  });
  it('the review type has the four fields and the states carry the statistics role on published only', () => {
    expect(reviewTypeDraft().resourceTypeIds).toEqual(['review']);
    expect(reviewTypeDraft().fieldDefinitions.map((f) => f.name)).toEqual(['storeKey', 'replyText', 'replyAt', 'replyBy']);
    const [published, hidden] = reviewStateDrafts();
    expect(published).toMatchObject({ key: 'review-published', type: 'ReviewState', roles: ['ReviewIncludedInStatistics'] });
    expect(hidden).toMatchObject({ key: 'review-hidden', type: 'ReviewState', roles: [] });
  });
});
