/** Product key and path of a medicine (`mlv-med-<slug>`, SKU `MED-<slug>`); shared by every surface that links a medicine. */
const SKU_RE = /^MED-([a-z0-9][a-z0-9-]*)$/i;
const KEY_RE = /^mlv-med-[a-z0-9-]+$/;

export const isMedicineKey = (key: string): boolean => KEY_RE.test(key);

/** Product key for a SKU, or null when the SKU is not a catalog medicine. */
export function medicineKeyForSku(sku: string | null | undefined): string | null {
  const m = sku ? SKU_RE.exec(sku) : null;
  return m ? `mlv-med-${m[1].toLowerCase()}` : null;
}

/** Locale-less path of the medicine page for a SKU, or null. Use with the locale-aware `Link`. */
export function medicinePathForSku(sku: string | null | undefined): string | null {
  const key = medicineKeyForSku(sku);
  return key ? `/medicine/${key}` : null;
}
