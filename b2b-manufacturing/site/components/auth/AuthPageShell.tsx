import type { ReactNode } from 'react';

/** Narrow centred column used by the sign-in and registration pages. */
export function AuthPageShell({ title, lead, children, wide }: { title: string; lead?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section className="s"><div className="wrap" style={{ maxWidth: wide ? 760 : 480 }}>
      <h1 style={{ marginBottom: 12 }}>{title}</h1>
      {lead ? <p style={{ color: 'var(--fg2)', marginBottom: 32 }}>{lead}</p> : null}
      {children}
    </div></section>
  );
}
