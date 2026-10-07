import type { ReactNode } from 'react';
import { cx } from './cx';

type TableProps = {
  /** Visually hidden caption that names the table for assistive technology. */
  caption: string;
  /** Column headers, rendered as `<th scope="col">`. */
  columns: string[];
  /** `<tr>` rows (with `<td>` cells) for the body. */
  children: ReactNode;
  className?: string;
};

/** Themed table with a real header row; scrolls horizontally on narrow screens. */
export function Table({ caption, columns, children, className }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('table', className)}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
