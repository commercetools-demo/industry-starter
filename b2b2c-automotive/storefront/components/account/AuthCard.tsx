// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReactNode } from 'react';

/** The bordered panel of the sign-in, register and reset pages (same markup as the sign-in page of workstream N). */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-content gap-5 p-4 min-[64rem]:p-5">
      <div className="mx-auto grid w-full max-w-prose gap-5 rounded-md border border-border bg-surface p-5">
        <h1 className="m-0 font-display text-2xl font-semibold text-text">{title}</h1>
        {children}
      </div>
    </div>
  );
}
