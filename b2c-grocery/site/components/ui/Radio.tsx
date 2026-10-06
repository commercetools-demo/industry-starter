'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type RadioProps = { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Real `<input type="radio">` with the Organic dot. Group radios with the same `name`; arrow keys move the selection natively. */
export function Radio({ label, className, ...rest }: RadioProps) {
  return (
    <label className={cx('radio has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent rounded-full', className)}>
      <input type="radio" {...rest} />
      <span className="dot" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}
