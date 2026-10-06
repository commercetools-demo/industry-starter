import { Button } from './Button';
import { cx } from './cx';

type SectionHeadingProps = {
  kicker: string;
  title: string;
  /** Optional right-aligned ghost link, e.g. "See all". */
  linkLabel?: string;
  linkHref?: string;
  className?: string;
};

/** Kicker (h6, accent-700) above an h2, with an optional ghost link on the right. */
export function SectionHeading({ kicker, title, linkLabel, linkHref, className }: SectionHeadingProps) {
  return (
    <div className={cx('flex items-end justify-between gap-(--space-4)', className)}>
      <div>
        <h6 className="text-accent-700">{kicker}</h6>
        <h2 className="m-0 text-[38px]">{title}</h2>
      </div>
      {linkLabel && linkHref ? (
        <Button href={linkHref} variant="ghost">
          {linkLabel}
        </Button>
      ) : null}
    </div>
  );
}
