/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';
import { FaultView } from '@/components/layout/FaultView';

// Route error boundary inside the locale layout, so the header and footer stay (the session and cart
// are untouched by a render fault). Only `digest` is used; the error text and stack are never shown.
export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <FaultView reset={reset} digest={error.digest} />;
}
