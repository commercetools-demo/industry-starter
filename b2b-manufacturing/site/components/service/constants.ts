export const SECTOR_KEYS = ['facilities', 'manufacturing', 'property', 'healthcare'] as const;
export type SectorKey = (typeof SECTOR_KEYS)[number];
export const isSectorKey = (v: unknown): v is SectorKey => typeof v === 'string' && (SECTOR_KEYS as readonly string[]).includes(v);

export type ServiceCategory = 'plumbing' | 'waste-management';
export const CATEGORY_SLUGS: readonly ServiceCategory[] = ['plumbing', 'waste-management'];

export { siteUrl } from '@/lib/seo';

/** Message-namespace key for each category on the listing pages. */
export const CATEGORY_MESSAGE_KEY: Record<ServiceCategory, 'plumbing' | 'waste'> = { plumbing: 'plumbing', 'waste-management': 'waste' };
