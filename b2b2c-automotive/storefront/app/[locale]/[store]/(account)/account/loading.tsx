// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { StateMessage } from '@/components/account/Panel';

/** The loading state of every server rendered account page (a skeleton, announced as "Loading"). */
export default function AccountLoading() {
  // Tall enough that the footer starts below the fold: when the page streams in nothing visible jumps (CLS).
  return (
    <div className="min-h-screen">
      <StateMessage kind="loading" />
    </div>
  );
}
