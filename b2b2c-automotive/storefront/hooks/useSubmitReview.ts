// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useCallback, useState } from 'react';
import { HttpError, postJson } from '@/hooks/fetch-json';

export type SubmitReviewError = 'not-purchased' | 'already-reviewed' | 'invalid' | 'failed';

export interface ReviewInput {
  productId: string;
  rating: number;
  title: string;
  text: string;
}

/** `POST /api/reviews`. `submit` resolves to whether the review was created; `error` names the reason otherwise. */
export function useSubmitReview(): { submit: (input: ReviewInput) => Promise<boolean>; isSubmitting: boolean; error: SubmitReviewError | null } {
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SubmitReviewError | null>(null);
  const submit = useCallback(async (input: ReviewInput) => {
    setSubmitting(true);
    setError(null);
    try {
      await postJson<{ id: string }>('/api/reviews', input);
      return true;
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 0;
      setError(status === 403 ? 'not-purchased' : status === 409 ? 'already-reviewed' : status === 400 ? 'invalid' : 'failed');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submit, isSubmitting, error };
}
