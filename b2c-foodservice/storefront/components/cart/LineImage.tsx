import Image from 'next/image';
import { transformThumbnailImageUrl } from '@/lib/ct/image-config';

/** Cart line image in a `canvas-2` box of the given size (84x100 in the drawer, 96x116 on the page). */
export default function LineImage({ url, alt, width, height }: { url?: string; alt: string; width: number; height: number }) {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-field bg-canvas-2" style={{ width, height }}>
      {url ? <Image src={transformThumbnailImageUrl(url)} alt={alt} fill sizes={`${width}px`} className="object-cover" /> : null}
    </div>
  );
}
