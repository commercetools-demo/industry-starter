/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import Link from 'next/link';
import { redirect, useRouter } from 'next/navigation';

export function Nav() {
  const router = useRouter();
  if (!router) redirect('/');
  return <Link href="/">Home</Link>;
}
