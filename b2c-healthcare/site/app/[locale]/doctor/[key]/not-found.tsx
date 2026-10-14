/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { NotFoundView } from '@/components/layout/NotFoundView';

// "Doctor not found. Back to search" inside the locale layout, with HTTP 404.
export default function DoctorNotFound() {
  return <NotFoundView kind="doctor" />;
}
