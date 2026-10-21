import 'server-only';
import { domainError } from '@/lib/api-domain';
import { getReviewProducts } from '@/lib/ct/reviews';
import type { AlreadyReviewedError } from '@/lib/reviews/errors';
import { AppError, SAFE_MESSAGES } from '@/lib/errors';
import { toMyReviewView } from '@/lib/mappers/review';
import { hashKey, rateLimit } from '@/lib/rate-limit';
import type { ReviewFieldCode } from '@/lib/reviews/validate';
import type { MyReviewView } from '@/lib/types';

const HOUR = 3_600_000;

/** Create: 5 per hour per customer. Update and delete: 30 per hour per customer (Q-M-08, in memory per instance). */
export const CREATE_LIMIT = { limit: 5, windowMs: HOUR };
export const WRITE_LIMIT = { limit: 30, windowMs: HOUR };

export function assertWithinLimit(kind: 'create' | 'write', customerId: string): void {
  const result = rateLimit(hashKey('reviews', kind, customerId), kind === 'create' ? CREATE_LIMIT : WRITE_LIMIT);
  if (!result.allowed) throw new AppError('rate_limited', 429);
}

export function validationResponse(fields: Partial<Record<'rating' | 'title' | 'text', ReviewFieldCode>>): Response {
  return Response.json(
    { error: { code: 'validation_failed', message: SAFE_MESSAGES.validation_failed, fields } },
    { status: 422 },
  );
}

export const alreadyReviewedResponse = (e: AlreadyReviewedError): Response =>
  domainError('already_reviewed', 409, e.reviewId ? { reviewId: e.reviewId } : {});

export async function toMine(review: Parameters<typeof toMyReviewView>[0], locale: string): Promise<MyReviewView> {
  const productId = review.target?.typeId === 'product' ? review.target.id : '';
  const products = productId ? await getReviewProducts([productId], locale) : new Map();
  return toMyReviewView(review, products.get(productId) ?? null);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await req.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    throw new AppError('bad_request', 400);
  }
}
