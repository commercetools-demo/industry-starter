'use client';

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { ApiError } from '@/hooks/fetcher';
import { revalidateReviewLists } from '@/hooks/useReviews';
import { keyMyReviews } from '@/lib/cache-keys';
import type { MyReviewView, ReviewInput } from '@/lib/types';

/** A failed review write. `reviewId` is set for `already_reviewed`; `fields` for `validation_failed`. */
export class ReviewApiError extends ApiError {
  constructor(code: string, status: number, readonly extra: { reviewId?: string; fields?: Record<string, string> } = {}) {
    super(code, status);
    this.name = 'ReviewApiError';
  }
}

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ReviewApiError('upstream_unavailable', 0);
  }
  if (!res.ok) {
    let code = 'internal_error';
    const extra: { reviewId?: string; fields?: Record<string, string> } = {};
    try {
      const parsed = (await res.json()) as { error?: { code?: string; reviewId?: string; fields?: Record<string, string> } };
      if (typeof parsed.error?.code === 'string') code = parsed.error.code;
      if (typeof parsed.error?.reviewId === 'string') extra.reviewId = parsed.error.reviewId;
      if (parsed.error?.fields) extra.fields = parsed.error.fields;
    } catch {
      // keep internal_error
    }
    throw new ReviewApiError(code, res.status, extra);
  }
  return (await res.json()) as T;
}

/** Create, edit and delete one's own reviews. After each write the first page of the product's list and the own list refresh. */
export function useReviewActions(customerId: string | null) {
  const { mutate } = useSWRConfig();

  const refresh = useCallback(
    async (productId: string | null) => {
      await Promise.all([
        revalidateReviewLists(productId),
        ...(customerId ? [mutate(keyMyReviews(customerId))] : []),
      ]);
    },
    [mutate, customerId],
  );

  const create = useCallback(
    async (productId: string, input: ReviewInput): Promise<MyReviewView> => {
      const { review } = await send<{ review: MyReviewView }>('/api/reviews', 'POST', { productId, ...input });
      await refresh(productId);
      return review;
    },
    [refresh],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ReviewInput>, productId: string | null = null): Promise<MyReviewView> => {
      const { review } = await send<{ review: MyReviewView }>(`/api/reviews/${encodeURIComponent(id)}`, 'PATCH', patch);
      await refresh(productId ?? review.product?.id ?? null);
      return review;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string, productId: string | null = null): Promise<void> => {
      await send<{ ok: true }>(`/api/reviews/${encodeURIComponent(id)}`, 'DELETE');
      await refresh(productId);
    },
    [refresh],
  );

  return { create, update, remove };
}

