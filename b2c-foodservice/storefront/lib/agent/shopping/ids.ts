/**
 * The id scheme: ONE module for encode and decode (the most consequential backend decision, and the hardest to change later).
 *
 * The agent's contract is that ids are opaque strings passed through unchanged, and that a family id and a variant id share one namespace.
 *
 *   fam:<mcp-product-id>   a FAMILY: a product with more than one variant. Options still to choose. Not buyable: every cart write refuses it
 *                          (the options hold lives in the gates and the backend, not in the UI). It has no SKU of its own.
 *   <sku>                  a plain product, or a variant addressed by its SKU. The Shopper MCP's cart `item.id` is the variant SKU.
 *
 * Decoding never throws: an unrecognised string is a SKU, and resolving it is the catalogue's job (an unknown id yields null there).
 * The residual ambiguity (a SKU that is literally `fam:...`) is not worth defending against.
 */
export const FAMILY_PREFIX = 'fam:';

export type DecodedId = { kind: 'family'; mcpId: string } | { kind: 'sku'; sku: string };

export function encodeFamilyId(mcpProductId: string): string {
  return `${FAMILY_PREFIX}${mcpProductId}`;
}

export function decodeId(raw: string): DecodedId {
  const id = String(raw ?? '').trim();
  if (id.startsWith(FAMILY_PREFIX) && id.length > FAMILY_PREFIX.length) return { kind: 'family', mcpId: id.slice(FAMILY_PREFIX.length) };
  return { kind: 'sku', sku: id };
}

export function isFamilyId(raw: string): boolean {
  return decodeId(raw).kind === 'family';
}
