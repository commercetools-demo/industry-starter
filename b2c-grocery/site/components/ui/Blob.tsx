/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { CSSProperties } from 'react';
import { cx } from './cx';

/** Decorative sage circle. */
export function Blob({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={cx('blob', className)} style={style} />;
}
