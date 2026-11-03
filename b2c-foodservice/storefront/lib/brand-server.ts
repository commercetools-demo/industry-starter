import 'server-only';
import { headers } from 'next/headers';
import { BRAND_HEADER, brandOf, type BrandConfig } from '@/lib/brands';

/** The brand of the current request (set by the proxy from the first URL segment); the default brand when the header is absent. */
export async function getBrand(): Promise<BrandConfig> {
  return brandOf((await headers()).get(BRAND_HEADER));
}
