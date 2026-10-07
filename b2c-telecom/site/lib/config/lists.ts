// Constants of the saved lists (workstream T). Never inline these numbers.

/** Lists per customer. */
export const MAX_LISTS = 20;
/** Lines per list (a bundle never holds more; commercetools allows 250). */
export const MAX_LINES_PER_LIST = 25;
export const LIST_NAME_MAX = 60;
/** Quantity of a saved line: a phone plan is sold per line, 1 to 5 lines (D-014). */
export const LIST_LINE_QUANTITY_MIN = 1;
export const LIST_LINE_QUANTITY_MAX = 5;
/** Custom type of a saved line (the price when it was saved). */
export const LIST_LINE_TYPE_KEY = 'malva-list-line';
/** Every list we create has a `malva-` key. */
export const LIST_KEY_PREFIX = 'malva-list-';
