/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ElementType, ReactNode } from 'react';
import { cx } from '@/components/ui/cx';

export function Container({ as: Tag = 'div', className, children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={cx('page', className)}>{children}</Tag>;
}
