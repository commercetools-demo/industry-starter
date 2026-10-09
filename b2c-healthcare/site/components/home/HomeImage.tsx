import { cx } from '@/components/ui/cx';

/** Decorative home banner: a token-styled gradient block. Children (the hero's floating chip) are positioned over it. */
export function HomeImage({
  className,
  gradient = 'bg-(image:--gradient-brand)',
  children,
}: {
  className?: string;
  gradient?: string;
  children?: React.ReactNode;
}) {
  return (
    <div data-image="placeholder" className={cx('relative overflow-hidden', className, gradient)}>
      {children}
    </div>
  );
}
