/** Public tracking pages of the carriers the shop ships with (D-034: standard carrier delivery). Unknown carrier: no link. */
const TEMPLATES: { match: RegExp; url: (id: string) => string }[] = [
  { match: /^ups\b/i, url: (id) => `https://www.ups.com/track?tracknum=${id}` },
  { match: /^usps\b|postal service/i, url: (id) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${id}` },
  { match: /^fedex\b/i, url: (id) => `https://www.fedex.com/fedextrack/?trknbr=${id}` },
  { match: /canada post/i, url: (id) => `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${id}` },
];

/** A link to the carrier's tracking page, or null when the carrier is unknown or the id is empty. The id is encoded. */
export function trackingUrl(carrier: string | null, trackingId: string | null): string | null {
  if (!carrier || !trackingId) return null;
  const template = TEMPLATES.find((t) => t.match.test(carrier.trim()));
  return template ? template.url(encodeURIComponent(trackingId)) : null;
}
