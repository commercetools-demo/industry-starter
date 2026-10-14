// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Factory for `vi.mock('@/i18n/routing', ...)` in the home tests: Link renders the en-US path, no providers needed. It imports
// nothing from the app so the mock can load it without a cycle.
//   vi.mock('@/i18n/routing', async () => (await import('@/test/routing-mock')).mockRouting());
import type { ReactNode } from 'react';

export const mockRouting = () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={`/en-US${href}`} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ refresh: () => undefined, replace: () => undefined }),
  usePathname: () => '/mau-reseller-north',
});
