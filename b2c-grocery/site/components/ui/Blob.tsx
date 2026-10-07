import type { CSSProperties } from 'react';
import { cx } from './cx';

/** Decorative sage circle. */
export function Blob({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={cx('blob', className)} style={style} />;
}
