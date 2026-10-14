/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// Strict request bodies of the catalog seller routes. Unknown keys are refused (400), so a client can never send the facts the
// server owns (a list price, a cost, a currency per change). Pure.
import { z } from 'zod';
import { SAFE_ID } from './discount-rule';

const StoreKey = z.string().min(1).max(256);
const ProductId = z.string().min(1).max(100);
const Locale = z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, 'Invalid language');

export const AssortmentFilter = z
  .object({
    state: z.enum(['all', 'assigned', 'available', 'blocked']).optional(),
    text: z.string().max(200).optional(),
    categoryId: z.string().regex(SAFE_ID).optional(),
  })
  .strict();

const oneOf = (b: { productIds?: unknown; filter?: unknown }) => (b.productIds === undefined) !== (b.filter === undefined);
const ONE_OF = 'Send productIds or filter';

export const ImpactBody = z.object({ storeKey: StoreKey, productIds: z.array(ProductId).min(1).max(5000) }).strict();

export const AssignBody = z
  .object({ storeKey: StoreKey, productIds: z.array(ProductId).min(1).max(5000).optional(), filter: AssortmentFilter.optional() })
  .strict()
  .refine(oneOf, ONE_OF);

export const WithdrawBody = z
  .object({ storeKey: StoreKey, productIds: z.array(ProductId).min(1).max(5000).optional(), filter: AssortmentFilter.optional(), confirm: z.boolean().optional(), expectedCount: z.number().int().min(0).optional() })
  .strict()
  .refine(oneOf, ONE_OF);

export const ReconcileBody = z.object({ storeKey: StoreKey }).strict();

const Currency = z.enum(['EUR', 'USD']);
const Sku = z.string().min(1).max(100).regex(SAFE_ID, 'Invalid part number');

export const PriceChangeSchema = z.object({ sku: Sku, centAmount: z.number().nullable() }).strict();

export const PublishBody = z
  .object({ storeKey: StoreKey, currency: Currency.optional(), changes: z.array(PriceChangeSchema).min(1).max(2000), confirm: z.boolean().optional(), expectedCount: z.number().int().min(0).optional() })
  .strict();

export const BulkBody = z
  .object({
    storeKey: StoreKey,
    currency: Currency.optional(),
    mode: z.enum(['percentOfList', 'setTo']),
    value: z.number().finite(),
    skus: z.array(Sku).min(1).max(2000).optional(),
    filter: z.object({ text: z.string().max(200).optional() }).strict().optional(),
    dryRun: z.boolean().optional(),
    confirm: z.boolean().optional(),
    expectedCount: z.number().int().min(0).optional(),
  })
  .strict()
  .refine((b) => (b.skus === undefined) !== (b.filter === undefined), 'Send skus or filter');

export const ImportBody = z
  .object({ storeKey: StoreKey, currency: Currency.optional(), csv: z.string().max(400_000), dryRun: z.boolean().optional(), confirm: z.boolean().optional(), expectedCount: z.number().int().min(0).optional() })
  .strict();

export const ImageUrlBody = z.object({ storeKey: StoreKey, url: z.string().max(2000) }).strict();

// ---- discounts ----

const Name = z.record(Locale, z.string().max(120));
const Schedule = { validFrom: z.string().max(40).optional(), validUntil: z.string().max(40).optional() };
const Id = z.string().max(200);

const ProductScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }).strict(),
  z.object({ kind: z.literal('category'), categoryId: Id, label: z.string().max(200) }).strict(),
  z.object({ kind: z.literal('skus'), skus: z.array(z.string().max(100)).max(200) }).strict(),
]);

const CartConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('always') }).strict(),
  z.object({ kind: z.literal('cartTotalAtLeast'), centAmount: z.number() }).strict(),
  z.object({ kind: z.literal('category'), categoryId: Id }).strict(),
]);

const ProductEffectSchema = z.discriminatedUnion('kind', [z.object({ kind: z.literal('relative'), percent: z.number() }).strict(), z.object({ kind: z.literal('absolute'), centAmount: z.number() }).strict()]);
const CartEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('relative'), percent: z.number() }).strict(),
  z.object({ kind: z.literal('absolute'), centAmount: z.number() }).strict(),
  z.object({ kind: z.literal('freeShipping') }).strict(),
]);

export const ProductRuleSchema = z.object({ name: Name, scope: ProductScopeSchema, effect: ProductEffectSchema, ...Schedule }).strict();
export const CartRuleSchema = z
  .object({ name: Name, condition: CartConditionSchema, effect: CartEffectSchema, stacking: z.enum(['Stacking', 'StopAfterThisDiscount']), code: z.string().max(60).optional(), ...Schedule })
  .strict();

/** `rule` absent creates the draft ("New cart rule (draft)"). */
export const CreateProductBody = z.object({ storeKey: StoreKey, rule: ProductRuleSchema.optional() }).strict();
export const CreateCartBody = z.object({ storeKey: StoreKey, rule: CartRuleSchema.optional() }).strict();
export const PatchProductBody = z.object({ storeKey: StoreKey, rule: ProductRuleSchema }).strict();
export const PatchCartBody = z.object({ storeKey: StoreKey, rule: CartRuleSchema }).strict();
export const ActiveBody = z.object({ storeKey: StoreKey, isActive: z.boolean() }).strict();
export const PriorityBody = z.object({ storeKey: StoreKey, kind: z.enum(['product', 'cart']), orderedIds: z.array(z.string().min(1).max(100)).max(500) }).strict();

export const DiscountKindParam = z.enum(['product', 'cart']);
