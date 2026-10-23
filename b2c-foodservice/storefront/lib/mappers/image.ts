import type { Image as SDKImage } from '@commercetools/platform-sdk';
import { cleanImageUrl } from '@/lib/ct/image-config';
import type { ImageRef } from '@/lib/types';

export function mapImages(images: SDKImage[] | undefined, alt: string): ImageRef[] {
  return (images ?? []).map((img) => ({
    url: cleanImageUrl(img.url),
    width: img.dimensions?.w,
    height: img.dimensions?.h,
    alt: img.label || alt,
  }));
}
