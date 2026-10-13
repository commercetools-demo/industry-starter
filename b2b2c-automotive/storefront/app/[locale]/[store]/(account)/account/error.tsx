// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { StateMessage } from '@/components/account/Panel';

/** The error state of every account page: plain words and a retry (the page is rendered again). Nothing of the error reaches the screen. */
export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <StateMessage kind="error" onRetry={reset} />;
}
