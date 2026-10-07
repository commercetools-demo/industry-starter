export const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 10_000;

type Raw = string | string[] | undefined;
const first = (value: Raw): string | undefined => (Array.isArray(value) ? value[0] : value);

/** `q`: trimmed and cut to 100 characters (trimmed again so the cut cannot leave trailing blanks). */
export function parseSearchQuery(raw: Raw): string {
  return (first(raw) ?? '').trim().slice(0, MAX_QUERY_LENGTH).trim();
}

/** `page`: a positive integer, anything else is page 1. */
export function parseSearchPage(raw: Raw): number {
  const text = first(raw);
  const page = text !== undefined && /^\d+$/.test(text) ? Number(text) : 1;
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}
