/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/** Decorative loading placeholder. Put `aria-busy` on the region that is loading, not on this. */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" data-skeleton className={cx('h-4 animate-pulse rounded-md bg-neutral-100', className)} {...rest} />;
}
