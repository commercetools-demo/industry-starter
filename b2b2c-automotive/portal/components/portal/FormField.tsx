/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import type { ReactNode } from 'react';
import { hintClass, labelClass } from './kit';

/** A labelled field row of the admin screens: label above, control, optional hint below. */
export function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-150">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className={hintClass}>{hint}</p> : null}
    </div>
  );
}
