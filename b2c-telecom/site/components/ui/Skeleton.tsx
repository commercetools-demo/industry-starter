/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactElement } from 'react';
import { cx } from '@/lib/cx';

/** Loading placeholder; `className` carries the width and height utilities. */
export function Skeleton({ className }: { className?: string }): ReactElement {
  return <span aria-hidden="true" className={cx('block rounded-md bg-neutral-100 motion-safe:animate-pulse', className)} />;
}
