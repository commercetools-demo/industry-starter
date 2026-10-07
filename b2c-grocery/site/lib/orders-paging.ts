export const ORDERS_PAGE_SIZE = 10;

/** `?page=` as a positive integer; anything else (missing, 0, negative, text) is page 1. */
export function parsePage(value: string | null | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
