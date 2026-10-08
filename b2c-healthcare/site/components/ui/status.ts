import type { BadgeVariant } from './Badge';

export type StatusKind =
  | 'available'
  | 'free'
  | 'ready'
  | 'normal'
  | 'processing'
  | 'out-of-range'
  | 'next-availability'
  | 'info';

/**
 * Status colour mapping (design-system-tokens: Green means available or free):
 * available/free/ready/normal = success, processing = warning, out-of-range = danger,
 * information such as the next availability = info.
 */
export function statusVariant(status: StatusKind): BadgeVariant {
  switch (status) {
    case 'available':
    case 'free':
    case 'ready':
    case 'normal':
      return 'ok';
    case 'processing':
      return 'wait';
    case 'out-of-range':
      return 'no';
    case 'next-availability':
    case 'info':
      return 'info';
  }
}
