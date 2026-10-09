/** Banner/section image slots for the website (not stored in commercetools). `data/site-images.json` holds the picks. */
export interface SiteImageSlot {
  slot: string;
  /** Search phrase for the image script. */
  query: string;
  note: string;
}

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  { slot: 'home-hero', query: 'technician industrial plant', note: 'Home hero, full bleed with a 40% overlay' },
  { slot: 'pillar-plumbing', query: 'industrial pipework drainage', note: 'Home pillar card: Plumbing' },
  { slot: 'pillar-waste', query: 'waste collection recycling', note: 'Home pillar card: Waste management' },
  { slot: 'cctv-survey', query: 'cctv drain survey', note: 'Plumbing page supporting band' },
  { slot: 'team-fleet', query: 'maintenance team vans fleet', note: 'About page story image' },
];
