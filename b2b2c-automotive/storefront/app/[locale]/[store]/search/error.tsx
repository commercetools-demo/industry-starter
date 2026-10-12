// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { ListingError } from '@/components/listing/ListingError';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ListingError reset={reset} />;
}
