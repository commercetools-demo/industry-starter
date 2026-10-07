import { notFound } from 'next/navigation';

// Every unmatched /<locale>/... URL (including a product-detail-shaped one, D-052) gets the localized 404 with the full frame.
export default function CatchAll(): never {
  notFound();
}
