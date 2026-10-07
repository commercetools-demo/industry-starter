import type { ReactElement, ReactNode } from 'react';
import { AccountNav } from './AccountNav';

/** The frame of every account page (S, T, V): the navigation rail and the page. Pages guard themselves; the frame holds no data. */
export function AccountShell({ children }: { children: ReactNode }): ReactElement {
  return (
    <div className="mx-auto grid w-full max-w-(--container-width) grid-cols-1 gap-7 px-5 py-8 md:px-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-9">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <AccountNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
