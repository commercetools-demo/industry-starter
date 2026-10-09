import { z } from 'zod';

/** Request-body schemas of the quote-list and quote-request routes (parsed with `parseBody`). */
const optionalText = (max: number) => z.string().max(max).nullish();

export const addLineSchema = z.object({
  serviceId: z.string().max(100).optional(),
  serviceSlug: z.string().max(200).optional(),
  frequency: optionalText(30),
  note: optionalText(2000),
}).refine((b) => Boolean(b.serviceId || b.serviceSlug), { message: 'Choose a service to add.', path: ['serviceId'] });

export const patchLineSchema = z.object({ frequency: optionalText(30), note: optionalText(2000) })
  .refine((b) => b.frequency !== undefined || b.note !== undefined, { message: 'Nothing to change.', path: ['frequency'] });

export const submitRequestSchema = z.object({
  idempotencyKey: z.string().max(100),
  locale: z.string().max(10).optional(),
  fields: z.record(z.string(), z.unknown()),
  website: z.string().max(500).optional(),
}, { error: 'Invalid request.' });
