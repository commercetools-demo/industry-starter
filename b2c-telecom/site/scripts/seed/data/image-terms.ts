// Search terms for the seeded images (D-055). Generic on purpose: no brands. Keys are category and offer keys.
import type { Target } from '../images';

const CABLE = 'cable internet router home';
const WIRELESS = 'home wifi router 5g';
const PHONE = 'family phone call';
const STREAMING = 'streaming entertainment couch';
const PROTECTION = 'phone security protection';
const EQUIPMENT = 'wifi router modem';
const DEVICES = 'smartphone';

export const CATEGORY_TERMS: Record<string, string> = {
  'malva-cat-phone-plans': PHONE,
  'malva-cat-devices': DEVICES,
  'malva-cat-home-wireless': WIRELESS,
  'malva-cat-cable-internet': CABLE,
  'malva-cat-add-ons': STREAMING,
  'malva-cat-streaming': STREAMING,
  'malva-cat-protection': PROTECTION,
  'malva-cat-equipment': EQUIPMENT,
};

export const OFFER_TERMS: Record<string, string> = {
  'malva-offer-cable-100': CABLE,
  'malva-offer-cable-500': CABLE,
  'malva-offer-cable-gig': CABLE,
  'malva-offer-cable-existing-customer': CABLE,
  'malva-offer-wireless-lite': WIRELESS,
  'malva-offer-wireless-5g': WIRELESS,
  'malva-offer-wireless-5g-plus': WIRELESS,
  'malva-offer-phone-essential': PHONE,
  'malva-offer-phone-plus': PHONE,
  'malva-offer-phone-unlimited': PHONE,
  'malva-offer-phone-unlimited-max': PHONE,
  'malva-offer-phone-online-only': PHONE,
  'malva-offer-spotify': 'music headphones',
  'malva-offer-appletv': 'living room tv',
  'malva-offer-applemusic': 'listening to music',
  'malva-offer-netflix': 'watching tv couch',
  'malva-offer-disneyplus': 'family movie night',
  'malva-offer-cloud-200': 'cloud storage laptop',
  'malva-offer-device-protect': 'smartphone screen protector',
  'malva-offer-secure': PROTECTION,
  'malva-offer-router-ac1200': EQUIPMENT,
  'malva-offer-router-ax3000': EQUIPMENT,
  'malva-offer-mesh-be9300': EQUIPMENT,
  'malva-offer-modem-docsis31': EQUIPMENT,
  'malva-offer-5g-gateway': EQUIPMENT,
  'malva-offer-phone-nova-5g': DEVICES,
  'malva-offer-phone-nova-pro': DEVICES,
};

/** Every key that gets images, with its term (categories first, then offers). */
export const IMAGE_TARGETS: Target[] = [
  ...Object.entries(CATEGORY_TERMS).map(([key, term]) => ({ key, term })),
  ...Object.entries(OFFER_TERMS).map(([key, term]) => ({ key, term })),
];
