// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { notFound } from 'next/navigation';

// Where proxy.ts rewrites a request for an unknown store, with status 404; the locale not-found page renders.
export default function StoreNotFound(): never {
  notFound();
}
