export async function loadCart(id: string) {
  await fetch(`/api/cart/${id}`);
  return fetch('/api/cart');
}
