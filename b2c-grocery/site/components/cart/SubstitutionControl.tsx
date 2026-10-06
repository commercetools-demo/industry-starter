import type { CartLine } from '@/lib/types';

/** Extension point for workstream U (per-line substitution preference). Renders nothing in J. */
export function SubstitutionControl(props: { line: CartLine }) {
  void props;
  return null;
}
