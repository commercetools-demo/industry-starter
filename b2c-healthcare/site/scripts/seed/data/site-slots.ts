/** Banner slots consumed by site/content/images.ts (not stored in commercetools). One photo per slot. */
export interface SiteSlot { slot: string; query: string }

export const SITE_SLOTS: SiteSlot[] = [
  { slot: 'home-hero', query: 'doctor consultation video call' },
  { slot: 'home-cta', query: 'friendly pharmacist helping customer' },
  { slot: 'home-rx-delivery', query: 'medicine delivery package' },
  { slot: 'journal-1', query: 'healthy breakfast wellness' },
  { slot: 'journal-2', query: 'person sleeping peacefully' },
  { slot: 'journal-3', query: 'walking outdoors healthy lifestyle' },
];
