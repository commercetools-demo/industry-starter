import type { ReactNode } from 'react';
import { AccountShell } from '@/components/account/AccountShell';

// Frame only. There is no layout-level guard: layouts do not re-run on client navigation, so every account page calls
// `requireCustomerPage` itself (R).
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
