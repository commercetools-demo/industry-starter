import { cx } from '@/components/ui/cx';

/** Decorative cover: a token-styled gradient block. */
export function ArticleCover({ className }: { className?: string }) {
  return <div data-cover="placeholder" aria-hidden="true" className={cx('relative aspect-video w-full overflow-hidden rounded-lg', className, 'bg-(image:--gradient-sky)')} />;
}
