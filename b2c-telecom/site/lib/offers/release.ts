// Read side of the coordinated offer release (workstream X, D-057). Pure, no I/O: shared by the server reads, the client and the
// release engine. An offer is purchasable only inside its release window: released iff (startTime unset or startTime <= now) and
// (endTime unset or now < endTime). A malformed date means NOT released (fail closed).

export interface ReleaseWindow {
  startTime?: string | null;
  endTime?: string | null;
}

export class ReleaseError extends Error {
  readonly code = 'OFFER_NOT_RELEASED';
  constructor(readonly offerKey: string) {
    super(`Offer ${offerKey} is not released`);
    this.name = 'ReleaseError';
  }
}

/** Apply refuses a release instant closer than this (the write phase and the search index update must finish before it). */
export const RELEASE_MIN_LEAD_MS = 10 * 60 * 1000;

function instant(value: string): number {
  return Date.parse(value);
}

export function isOfferReleased(offer: ReleaseWindow, now: Date = new Date()): boolean {
  const at = now.getTime();
  if (Number.isNaN(at)) return false;
  if (offer.startTime !== undefined && offer.startTime !== null) {
    const start = instant(offer.startTime);
    if (Number.isNaN(start) || start > at) return false;
  }
  if (offer.endTime !== undefined && offer.endTime !== null) {
    const end = instant(offer.endTime);
    if (Number.isNaN(end) || at >= end) return false;
  }
  return true;
}

export function filterReleased<T extends ReleaseWindow>(offers: T[], now: Date = new Date()): T[] {
  return offers.filter((offer) => isOfferReleased(offer, now));
}

export function assertReleased(offer: ReleaseWindow & { key: string }, now: Date = new Date()): void {
  if (!isOfferReleased(offer, now)) throw new ReleaseError(offer.key);
}
