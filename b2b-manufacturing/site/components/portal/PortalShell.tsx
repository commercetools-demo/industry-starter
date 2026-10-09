import type { ReactNode } from 'react';
import { PortalNav } from './PortalNav';

export function PortalShell({ firstName, children }: { firstName: string; children: ReactNode }) {
  return (
    <div className="wrap portal" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)', gap: 40, paddingTop: 'var(--sp-8)', paddingBottom: 'var(--sp-10)' }}>
      <PortalNav firstName={firstName} />
      <div className="portal-main">{children}</div>
    </div>
  );
}
