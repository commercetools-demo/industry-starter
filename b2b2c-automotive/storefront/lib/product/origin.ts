// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import 'server-only';
import { headers } from 'next/headers';

/** Origin of the request for absolute canonical and JSON-LD addresses; a Host header that is not a plain host name gives `null`. */
export async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host || !/^[A-Za-z0-9.-]+(:\d+)?$/.test(host)) return null;
  return `${h.get('x-forwarded-proto') === 'https' ? 'https' : 'http'}://${host}`;
}
