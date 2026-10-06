/** Delivery-slot configuration (D-033, D-046: slots carry no price). */
export const SLOT_CONFIG = {
  /** Days offered, starting today. */
  days: 7,
  /** Window start hours; each window lasts `windowHours`. */
  windows: [8, 10, 12, 14, 16, 18],
  windowHours: 2,
  /** Orders per window. */
  capacity: 10,
  /** How long a picked slot stays reserved for the cart. */
  holdMinutes: 15,
} as const;
