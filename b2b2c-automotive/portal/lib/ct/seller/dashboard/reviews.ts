// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Unanswered reviews of the store (S-02). The review custom type `malva-review` belongs to workstream V; while it does not exist
// (or has no matching review) the answer is 0, never an error.
import 'server-only';
import { adminRoot } from '@/lib/ct/admin-client';
import { withTimeout } from './timeout';

const clean = (key: string) => key.replace(/["\\]/g, '');

export function countUnansweredReviews(storeKey: string): Promise<number> {
  return withTimeout(
    adminRoot
      .reviews()
      .get({
        queryArgs: {
          where: `custom(fields(storeKey="${clean(storeKey)}")) and custom(fields(replyText is not defined))`,
          limit: 1,
          withTotal: true,
        },
      })
      .execute()
      .then(({ body }) => body.total ?? 0)
      // A project without the review type answers 400 for the unknown custom field: that is zero reviews, not a failure.
      .catch((error: unknown) => {
        if ((error as { statusCode?: unknown } | null)?.statusCode === 400) return 0;
        throw error;
      }),
  );
}
