/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** The one place that assigns `window.location` (tests replace this module). */
export function hardNavigate(url: string): void {
  window.location.assign(url);
}
