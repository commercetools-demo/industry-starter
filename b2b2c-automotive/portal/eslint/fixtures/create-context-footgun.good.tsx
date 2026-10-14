/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import type { Data } from '@commercetools-demo/puck-types';
import { PageManager } from '@commercetools-demo/puck-page-manager';

export default function Page({ data }: { data?: Data }) {
  return <PageManager data={data} />;
}
