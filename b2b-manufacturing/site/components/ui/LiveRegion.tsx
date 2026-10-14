/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

/** A polite live region; render it always and change its text so assistive technology announces the change. */
export function LiveRegion({ children, assertive }: { children?: React.ReactNode; assertive?: boolean }) {
  return <div role={assertive ? 'alert' : 'status'} aria-live={assertive ? 'assertive' : 'polite'} aria-atomic="true" className="sr-only">{children}</div>;
}
