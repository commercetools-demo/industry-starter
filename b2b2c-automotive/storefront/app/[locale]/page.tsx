// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';

// /de-DE without a store segment is the not-found page; there is no dealer locator.
export default function LocaleRoot(): never {
  notFound();
}
