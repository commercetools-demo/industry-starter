'use client';
import { transformListingImageUrl } from '@/lib/ct/image-config';

export default function Widget({ url }: { url: string }) {
  return <span>{transformListingImageUrl(url)}</span>;
}
