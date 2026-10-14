/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// E-mail campaigns by audience rule (W-07). A campaign is a stored record `{ name, templateKey, rule, status: Draft | Ready,
// recipientCount, openRate: null }` in container `malva-email-campaigns`, key `<storeKey>--<id>`. There is NO send function, NO
// persisted recipient list and NO mail queue (D8, Q-P01): "Mark ready" stores a count only. Consent is always applied.
import 'server-only';
import type { CampaignStatus, EmailCampaignView, Suggestion, SuggestResult } from '@/lib/w-types';
import { CatalogError } from '@/lib/catalog/errors';
import { isTemplateKey, type TemplateKey } from '@/lib/email/defaults';
import { describe, parseRule, selectRecipients, type Rule } from '@/lib/marketing/audience';
import { parseDescription, type CategoryName } from '@/lib/marketing/parse-description';
import { listCategories } from './catalog-data';
import { loadAudienceFacts } from './audience-facts';
import { CONTAINERS, listStoreObjects, readObject, storeObjectKey, upsertObject } from './w-objects';

export type { CampaignStatus, EmailCampaignView, Suggestion, SuggestResult };

interface Stored {
  storeKey: string;
  id: string;
  name: string;
  templateKey: TemplateKey;
  rule: Rule;
  status: CampaignStatus;
  recipientCount: number | null;
  openRate: null;
  createdAt: string;
}

async function categoryNames(): Promise<{ list: CategoryName[]; byKey: Record<string, string> }> {
  const categories = await listCategories();
  return { list: categories.map((c) => ({ key: c.key, names: Object.values(c.name) })), byKey: Object.fromEntries(categories.map((c) => [c.key, c.name['en-US'] ?? Object.values(c.name)[0] ?? c.key])) };
}

const view = (s: Stored, byKey: Record<string, string>): EmailCampaignView => ({
  id: s.id,
  name: s.name,
  templateKey: s.templateKey,
  rule: s.rule,
  status: s.status,
  recipientCount: s.recipientCount,
  openRate: null,
  createdAt: s.createdAt,
  ruleText: describe(s.rule, byKey),
});

export async function listEmailCampaigns(storeKey: string): Promise<EmailCampaignView[]> {
  const [objects, names] = await Promise.all([listStoreObjects<Stored>(CONTAINERS.emailCampaigns, storeKey), categoryNames()]);
  return objects
    .map((o) => o.value)
    .filter((s) => parseRule(s.rule) !== null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((s) => view(s, names.byKey));
}

/** Rule and count for a plain-language description. Does not persist anything: the rule is stored only after "Use rule". */
export async function suggestAudience(storeKey: string, description: string): Promise<SuggestResult> {
  const names = await categoryNames();
  const parsed = parseDescription(description, names.list);
  if (!parsed.ok) return parsed;
  const facts = await loadAudienceFacts(storeKey);
  return { ok: true, rule: parsed.rule, text: describe(parsed.rule, names.byKey), count: selectRecipients(parsed.rule, facts).length };
}

export interface NewEmailCampaign {
  name: string;
  templateKey: string;
  rule: unknown;
}

const newId = (now: number) => `c${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Stores a Draft. The rule is parsed strictly again here; a client cannot store anything else than a valid rule. */
export async function createEmailCampaign(storeKey: string, input: NewEmailCampaign, now: number = Date.now()): Promise<EmailCampaignView> {
  const name = input.name.trim();
  if (name.length < 3 || name.length > 80) throw new CatalogError(400, 'NAME_LENGTH', 'The name needs 3 to 80 characters');
  if (!isTemplateKey(input.templateKey)) throw new CatalogError(400, 'UNKNOWN_TEMPLATE', 'Choose one of the templates');
  const rule = parseRule(input.rule);
  if (!rule) throw new CatalogError(400, 'INVALID_RULE', 'The audience rule is not valid');
  const id = newId(now);
  const stored: Stored = { storeKey, id, name, templateKey: input.templateKey, rule, status: 'Draft', recipientCount: null, openRate: null, createdAt: new Date(now).toISOString() };
  await upsertObject<Stored>(CONTAINERS.emailCampaigns, storeObjectKey(storeKey, id), () => stored);
  return view(stored, (await categoryNames()).byKey);
}

/** Stores the recipient COUNT and sets Ready. No recipient list is persisted and nothing is sent. */
export async function markReady(storeKey: string, id: string): Promise<EmailCampaignView> {
  if (!/^[A-Za-z0-9]{3,40}$/.test(id)) throw new CatalogError(404, 'CAMPAIGN_NOT_FOUND', 'Not found');
  const key = storeObjectKey(storeKey, id);
  const current = await readObject<Stored>(CONTAINERS.emailCampaigns, key);
  if (!current || current.value.storeKey !== storeKey) throw new CatalogError(404, 'CAMPAIGN_NOT_FOUND', 'Not found');
  const rule = parseRule(current.value.rule);
  if (!rule) throw new CatalogError(400, 'INVALID_RULE', 'The audience rule is not valid');
  const count = selectRecipients(rule, await loadAudienceFacts(storeKey)).length;
  const next = await upsertObject<Stored>(CONTAINERS.emailCampaigns, key, (c) => ({ ...(c as Stored), status: 'Ready', recipientCount: count }));
  return view(next, (await categoryNames()).byKey);
}
