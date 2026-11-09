// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/tools/presentation.py; changes: zod schemas instead of pydantic; null is accepted wherever upstream accepts None and is normalised to absent; parse functions throw PayloadInvalid with a readable message.

import { z } from 'zod';
import { PayloadInvalid } from '../../common/presentation';

/**
 * Payload schemas for the built-in presentation tools: what the model may send. The joins that turn a payload into what the host renders
 * live in `enrichment`. A schema library earns its place here because a rejected payload is fed back to the model, which retries: that
 * retry loop is a safety rule, and the validator's message is what makes it work. Undeclared keys are dropped (zod's default), not
 * rejected.
 */

/** Optional text the model may send as null: normalised to absent (omission, never null, travels through the code). */
const optional = <T extends z.ZodType>(schema: T) => schema.nullish().transform((v) => v ?? undefined);
const list = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .nullish()
    .transform((v) => v ?? []);

export const ProductPickSchema = z.object({ product_id: z.string(), reason: optional(z.string().max(140)) });

export const PresentProductsSchema = z.object({
  title: optional(z.string().max(80)),
  layout: z
    .enum(['carousel', 'grid', 'list'])
    .nullish()
    .transform((v) => v ?? 'carousel'),
  picks: z.array(ProductPickSchema).min(1).max(12),
});

export const ComparisonEntrySchema = z.object({
  product_id: z.string(),
  pros: list(z.string(), 4),
  cons: list(z.string(), 3),
  best_for: optional(z.string().max(80)),
});

export const PresentComparisonSchema = z.object({
  title: optional(z.string().max(80)),
  entries: z.array(ComparisonEntrySchema).min(2).max(4),
  dimensions: list(z.string(), 6),
  recommended_product_id: optional(z.string()),
});

export const PlanStepSchema = z.object({
  label: z.string().max(120),
  detail: optional(z.string().max(240)),
  product_ids: list(z.string(), 8),
});

export const PresentPlanSchema = z.object({
  title: z.string().max(80),
  intro: optional(z.string().max(240)),
  steps: z.array(PlanStepSchema).min(1).max(12),
});

export const GuideSectionSchema = z.object({ heading: z.string().max(80), body: z.string().max(600) });

export const PresentGuideSchema = z.object({
  title: z.string().max(80),
  sections: z.array(GuideSectionSchema).min(1).max(8),
  related_product_ids: list(z.string(), 8),
  sources: list(z.string(), 5),
});

export const PresentOrderStatusSchema = z.object({
  order_id: z.string(),
  summary: z.string().max(300),
  next_step: optional(z.string().max(200)),
});

/** Stages the cart for the host's checkout; nothing here charges. */
export const CheckoutSchema = z.object({
  note: optional(z.string().max(300)),
  fulfillment_method: optional(z.enum(['delivery', 'pickup', 'shipping'])),
});

/** The model picks the product; the host renders the backend's disclosure record. `title` is accepted and unused. */
export const PresentDisclosureSchema = z.object({ product_id: z.string(), title: optional(z.string().max(80)) });

export type PresentProductsPayload = z.output<typeof PresentProductsSchema>;
export type PresentComparisonPayload = z.output<typeof PresentComparisonSchema>;
export type PresentPlanPayload = z.output<typeof PresentPlanSchema>;
export type PresentGuidePayload = z.output<typeof PresentGuideSchema>;
export type PresentOrderStatusPayload = z.output<typeof PresentOrderStatusSchema>;
export type CheckoutPayload = z.output<typeof CheckoutSchema>;
export type PresentDisclosurePayload = z.output<typeof PresentDisclosureSchema>;

/** The validator's message in a form the model can act on: `path: problem` for each issue. */
export function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(input)'}: ${issue.message}`).join('; ');
}

/** A `parse` function for `PresentationComponent` built from a schema. */
export function parserFor<S extends z.ZodType>(schema: S): (input: Record<string, unknown>) => z.output<S> {
  return (input) => {
    const result = schema.safeParse(input);
    if (!result.success) throw new PayloadInvalid(describeIssues(result.error));
    return result.data;
  };
}
