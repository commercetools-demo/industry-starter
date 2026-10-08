import type { ReactNode } from 'react';
import { PageHead } from '@/components/ui/PageHead';

/** Sky page head plus the content column shared by the static pages (the layout provides <main>). */
export function StaticPage({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <>
      <PageHead title={title} sub={sub} />
      <div className="mx-auto grid max-w-content gap-6 px-5 py-8 nav:px-8">{children}</div>
    </>
  );
}
