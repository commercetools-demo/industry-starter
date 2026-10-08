// Constants of post-purchase order management (workstream V). Never inline these numbers.

export const CANCEL_REASONS = ['changed_mind', 'better_offer', 'moving', 'service_not_needed', 'other'] as const;
export const CANCEL_NOTE_MAX = 280;
/** Devices can be returned this many days after the order date (Planner default: one window for every device). */
export const DEVICE_RETURN_WINDOW_DAYS = 30;
export const RETURN_REASONS = ['defective', 'not_needed', 'wrong_item', 'other'] as const;
export const RETURN_NOTE_MAX = 280;
/** `false`: an order can be cancelled strictly before 00:00 UTC of its service start date; `true`: until the end of that day. */
export const CANCEL_WINDOW_INCLUSIVE = false;
/** Largest value of DEV_NOW_OFFSET_DAYS. */
export const DEV_NOW_OFFSET_MAX_DAYS = 400;
