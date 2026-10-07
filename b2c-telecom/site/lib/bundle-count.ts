import type { OfferKind } from '@/lib/types';

const COUNTED: readonly OfferKind[] = ['base-package', 'addon', 'bundle', 'device'];

/**
 * The number on the "My bundle" pill: line items (not quantity) of kind plan, add-on, bundle or device.
 * Equipment lines belong to a plan and are not counted. Planner default for the spec's "line items vs total quantity" question.
 */
export function countBundleLines(lines: { offerKind: OfferKind }[]): number {
  return lines.filter((line) => COUNTED.includes(line.offerKind)).length;
}
