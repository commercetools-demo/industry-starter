// Home page content is repo config (planner default of workstream O): no CMS, no custom objects, no per-customer targeting (D-005).
// Targets are category and offer KEYS: slugs are localized and editable, keys are stable.

export type PromoTone = 'dark' | 'light';
export interface PromoTileConfig {
  id: 'phone' | 'addons';
  tone: PromoTone;
  categoryKey: string;
}

export const HOME_CONFIG = {
  /** CTA target and image source of the hero. */
  hero: { categoryKey: 'malva-cat-cable-internet' },
  promoTiles: [
    { id: 'phone', tone: 'dark', categoryKey: 'malva-cat-phone-plans' },
    { id: 'addons', tone: 'light', categoryKey: 'malva-cat-add-ons' },
  ] as readonly PromoTileConfig[],
  /** Top-level categories not shown as tiles (devices are not designed on the home page). */
  hiddenCategoryKeys: ['malva-cat-devices'] as readonly string[],
  popularAddonOfferKeys: ['malva-offer-spotify', 'malva-offer-appletv', 'malva-offer-applemusic', 'malva-offer-netflix'] as readonly string[],
  popularAddonCount: 4,
} as const;
