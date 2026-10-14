/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Strict request bodies of workstream W's seller routes (marketing, e-mail, bundles, local products, import). Unknown keys are
// refused (400): a client can never send what the server owns (a discount value, a publish flag, a review state, a price per
// bundle component). The store key is only a claim that `authorizeSeller` compares with the session. Pure.
import { z } from 'zod';
import { IMPORT_TARGETS } from '@/lib/import/columns';

const StoreKey = z.string().min(1).max(256);
const Sku = z.string().min(1).max(64).regex(/^[A-Za-z0-9._-]+$/, 'Invalid part number');
const Localized = z.strictObject({ 'de-DE': z.string(), 'en-US': z.string() });

export const StoreOnlyBody = z.strictObject({ storeKey: StoreKey });

export const ClaimBody = z.strictObject({
  storeKey: StoreKey,
  amountCents: z.number().int().min(1).max(1_000_000_000),
  invoiceReference: z.string().trim().min(1).max(80),
  note: z.string().max(500),
});

export const TemplateBody = z.strictObject({ storeKey: StoreKey, subject: Localized, body: Localized, enabled: z.boolean() });
export const PreviewBody = z.strictObject({ storeKey: StoreKey, subject: Localized, body: Localized });

export const SuggestBody = z.strictObject({ storeKey: StoreKey, description: z.string().min(1).max(200) });
export const EmailCampaignBody = z.strictObject({ storeKey: StoreKey, name: z.string().max(200), templateKey: z.string().max(60), rule: z.unknown() });

export const BundleBody = z.strictObject({
  storeKey: StoreKey,
  name: z.string().max(200),
  discountPercent: z.number(),
  components: z.array(z.strictObject({ sku: Sku, qty: z.number() })).max(20),
});

export const LocalProductBody = z.strictObject({
  storeKey: StoreKey,
  name: z.strictObject({ 'de-DE': z.string().max(200).optional(), 'en-US': z.string().max(200).optional() }),
  sku: z.string().max(64),
  priceCents: z.number().int(),
  categoryKey: z.string().max(256),
  type: z.string().max(40),
  brandName: z.string().max(80).optional(),
  fitment: z.array(z.string().max(160)).max(50).optional(),
});

export const ImportBody = z.strictObject({
  storeKey: StoreKey,
  csv: z.string().max(1_100_000),
  overrides: z.record(z.string().max(200), z.enum([...IMPORT_TARGETS, 'ignore'])).optional(),
});
