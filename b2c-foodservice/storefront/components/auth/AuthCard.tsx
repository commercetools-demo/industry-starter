import type { ReactNode } from 'react';
import Card from '@/components/ui/Card';

interface AuthCardProps {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  /** Rendered below the card at the same width, 16px apart (the demo sign-in box). */
  below?: ReactNode;
}

/** The one frame of every auth screen: eyebrow, the page's only H1, one line of intro, then the card. */
export default function AuthCard({ eyebrow, title, intro, children, below }: AuthCardProps) {
  return (
    <div className="wrap mb-20 mt-12">
      <div className="mx-auto w-full max-w-[480px]">
        <p className="eyebrow mb-3">{eyebrow}</p>
        <h1 className="page-title m-0 text-ink">{title}</h1>
        {intro ? <p className="mb-6 mt-3 text-[15px] leading-relaxed text-ink-2">{intro}</p> : <div className="mb-6" />}
        <Card as="section">{children}</Card>
        {below ? <div className="mt-4">{below}</div> : null}
      </div>
    </div>
  );
}
