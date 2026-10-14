/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWFake, type WFake } from '@/lib/portal/w-fixture-root';
import { clearCatalogCaches } from './catalog-data';

let fake: WFake;
vi.mock('./catalog-root', () => ({ catalogRoot: async () => fake.root }));
vi.mock('./w-root', () => ({ wRoot: async () => fake.root }));

import { clearAudienceCache, loadAudienceFacts } from './audience-facts';
import { createEmailCampaign, listEmailCampaigns, markReady, suggestAudience } from './email-campaigns';

const NORTH = 'mau-reseller-north';
const SOUTH = 'mau-reseller-south';

beforeEach(() => {
  fake = createWFake({ demo: true });
  clearCatalogCaches();
  clearAudienceCache();
});

describe('audience facts', () => {
  it('reads consent from marketingConsent; a customer without the field has not consented', async () => {
    const facts = await loadAudienceFacts(NORTH);
    expect(facts).toHaveLength(6);
    expect(facts.map((f) => f.consent)).toEqual([true, true, true, true, false, false]);
  });
  it('knows bought categories with their ancestors and the last order date', async () => {
    const [first] = await loadAudienceFacts(NORTH);
    expect(first.categoryKeys).toEqual(expect.arrayContaining(['mau-cat-brakes', 'mau-cat-brake-pads', 'mau-cat-brake-discs']));
    expect([...first.skus].sort()).toEqual(['MLV-BD-42001', 'MLV-BP-41001']);
    expect(first.lastOrderAt).not.toBeNull();
  });
});

describe('suggest audience', () => {
  it('"Customers who bought brake discs but not pads" gives the rule, the words and a consented-only count; nothing is stored', async () => {
    fake.resetCalls();
    const result = await suggestAudience(NORTH, 'Customers who bought brake discs but not pads');
    // disc buyers: c1 (also pads), c2 (consented), c5 (not consented) -> only c2 qualifies
    expect(result).toMatchObject({ ok: true, count: 1, text: 'bought Brake discs and did not buy Brake pads' });
    expect(fake.writes()).toHaveLength(0);
    expect(await listEmailCampaigns(NORTH)).toEqual([]);
  });
  it('an unknown phrase returns the hint and the category names', async () => {
    const result = await suggestAudience(NORTH, 'people with red cars');
    expect(result).toMatchObject({ ok: false, hint: 'Try: customers who bought <category> but not <category>' });
  });
});

describe('campaign ready stores count only', () => {
  const rule = { all: [{ type: 'bought-category', categoryKey: 'mau-cat-brake-discs' }] };
  it('is created as Draft and marked Ready with the recipient count; no recipient list, no external call', async () => {
    const draft = await createEmailCampaign(NORTH, { name: 'TST-W Disc buyers', templateKey: 'win-back', rule });
    expect(draft).toMatchObject({ status: 'Draft', recipientCount: null, openRate: null, ruleText: 'bought Brake discs' });
    fake.resetCalls();
    const ready = await markReady(NORTH, draft.id);
    expect(ready).toMatchObject({ status: 'Ready', recipientCount: 2 }); // c1 and c2 consented; c5 is not
    const stored = [...fake.state.objects.values()].find((o) => o.container === 'malva-email-campaigns');
    expect(Object.keys(stored?.value ?? {}).sort()).toEqual(['createdAt', 'id', 'name', 'openRate', 'recipientCount', 'rule', 'status', 'storeKey', 'templateKey']);
    expect(JSON.stringify(stored?.value)).not.toMatch(/recipients|customerId|@example/);
    expect(fake.calls.every((c) => /^(object|customer|order|projection|category)\./.test(c.op))).toBe(true);
  });
  it('refuses an invalid rule or template and another store cannot mark the campaign ready', async () => {
    await expect(createEmailCampaign(NORTH, { name: 'TST-W bad', templateKey: 'win-back', rule: { all: [{ type: 'sql' }] } })).rejects.toMatchObject({ status: 400, code: 'INVALID_RULE' });
    await expect(createEmailCampaign(NORTH, { name: 'TST-W bad', templateKey: 'mystery', rule })).rejects.toMatchObject({ code: 'UNKNOWN_TEMPLATE' });
    await expect(createEmailCampaign(NORTH, { name: 'x', templateKey: 'win-back', rule })).rejects.toMatchObject({ code: 'NAME_LENGTH' });
    const draft = await createEmailCampaign(NORTH, { name: 'TST-W Disc buyers', templateKey: 'win-back', rule });
    await expect(markReady(SOUTH, draft.id)).rejects.toMatchObject({ status: 404 });
    expect(await listEmailCampaigns(SOUTH)).toEqual([]);
  });
});
