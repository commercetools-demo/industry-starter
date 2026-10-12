// Strict input of a tailoring save (T-07, decision 11): only name, description and images can be tailored. SKU, fitment,
// specifications and slug are rejected as unknown keys. Pure (also used by the editor for client-side hints).
import { z } from 'zod';

export const MAX_IMAGES = 10;

/** https, no credentials, no query string and no fragment (stored URLs are clean, JUNIOR-GUIDE rule 9). */
export function isCleanHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.hostname.length > 0;
  } catch {
    return false;
  }
}

const localized = (max: number) => z.record(z.string().regex(/^[a-z]{2}-[A-Z]{2}$/, 'Invalid language'), z.string().max(max));

export const ImageInput = z.object({
  url: z.string().max(2000).refine(isCleanHttpsUrl, 'Use an https image address without ? or #, and without a user name'),
  label: z.string().max(120).optional(),
});

export const TailoringInput = z
  .object({
    storeKey: z.string().min(1).max(256),
    name: localized(250).optional(),
    description: localized(10000).optional(),
    images: z.array(ImageInput).max(MAX_IMAGES, `At most ${MAX_IMAGES} images`).optional(),
  })
  .strict();

export type TailoringInputType = z.infer<typeof TailoringInput>;
export type TailoringFields = Omit<TailoringInputType, 'storeKey'>;
