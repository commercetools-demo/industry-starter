// Fixture for eslint/rules.test.mjs. Not part of the app (excluded from lint and tsc).
export async function load(id: string) {
  const a = await fetch('/api/cart');
  const b = await fetch(`/api/orders/${id}`);
  return [a, b];
}
