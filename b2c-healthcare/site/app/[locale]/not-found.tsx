/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { NotFoundView } from '@/components/layout/NotFoundView';

// Rendered inside the locale layout (header, footer, `#main`) with HTTP 404.
export default function LocaleNotFound() {
  return <NotFoundView />;
}
