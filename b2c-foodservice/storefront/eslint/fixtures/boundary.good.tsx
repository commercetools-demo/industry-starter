'use client';
import type { Product } from '@/lib/types';

export default function Widget({ product }: { product: Product }) {
  return <span>{product.name}</span>;
}
