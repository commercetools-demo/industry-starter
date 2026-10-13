// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import type { ReactNode } from 'react';

/**
 * Frame of every Malva page. Placeholder: renders the page only. The Malva header, footer and the finder drawer provider
 * (components 4.1 and 4.4) are added here, so the route group layout does not change.
 */
export function MalvaShell({ children }: { locale: string; children: ReactNode }) {
  return <>{children}</>;
}
