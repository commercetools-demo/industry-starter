import type { HomeLayout } from '@/lib/config/site';
import { HeroEditorial } from './HeroEditorial';
import { HeroGrid } from './HeroGrid';

/** Renders exactly one hero variant; the sections below do not depend on it. */
export function Hero({ layout, imageUrl }: { layout: HomeLayout; imageUrl: string }) {
  return layout === 'grid' ? <HeroGrid /> : <HeroEditorial imageUrl={imageUrl} />;
}
