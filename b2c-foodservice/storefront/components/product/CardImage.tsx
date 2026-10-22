import Image from 'next/image';
import { transformListingImageUrl } from '@/lib/ct/image-config';

/** 5:6 image area content. Without an image: a labelled placeholder (the images endpoint is OA-x2). */
export default function CardImage({ url, alt, placeholder, priority = false }: { url?: string; alt: string; placeholder: string; priority?: boolean }) {
  if (!url) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas-2 p-4 text-center text-[12px] text-ink-3">
        {placeholder}
      </div>
    );
  }
  return (
    <Image
      src={transformListingImageUrl(url)}
      alt={alt}
      fill
      sizes="(min-width: 1081px) 28vw, (min-width: 560px) 44vw, 46vw"
      className="object-cover"
      {...(priority ? { priority: true } : {})}
    />
  );
}
