import type { ReactNode } from 'react';
import { Container } from '@/components/layout/Container';
import { Card } from '@/components/ui/Card';

/** The 440 px dialog-style card (`lg x 1.15` radius, surface colour) every auth page sits in. */
export function AuthCard({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <Container className="py-(--space-8)">
      <Card elev="md" className="mx-auto w-full max-w-[440px] gap-(--space-3) p-(--space-4)" aria-labelledby="auth-title">
        <h2 id="auth-title" className="m-0">
          {title}
        </h2>
        {intro ? <p className="m-0 text-[14px] opacity-80">{intro}</p> : null}
        {children}
        {footer ? <div className="flex flex-col gap-(--space-1) text-[14px]">{footer}</div> : null}
      </Card>
    </Container>
  );
}
