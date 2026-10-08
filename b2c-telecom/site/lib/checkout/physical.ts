import type { CartLine } from '@/lib/types';

/** A line that ships: equipment and devices. Digital-only bundles skip the delivery step (D-043). */
export const isPhysicalLine = (line: Pick<CartLine, 'kind'>): boolean => line.kind === 'equipment' || line.kind === 'device';
