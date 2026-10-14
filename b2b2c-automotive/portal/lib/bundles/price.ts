// Bundle price arithmetic (W-08). Pure. `bundleCents = round(total * (100 - d) / 100)`, half to even.
export interface BundleComponentPrice {
  retailCents: number;
  qty: number;
}

function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (Math.abs(diff - 0.5) < 1e-9) return floor % 2 === 0 ? floor : floor + 1;
  return Math.round(value);
}

export function bundlePrice(components: readonly BundleComponentPrice[], discountPercent: number): { totalCents: number; bundleCents: number; savingCents: number } {
  const totalCents = components.reduce((sum, c) => sum + c.retailCents * c.qty, 0);
  const bundleCents = roundHalfEven((totalCents * (100 - discountPercent)) / 100);
  return { totalCents, bundleCents, savingCents: totalCents - bundleCents };
}
