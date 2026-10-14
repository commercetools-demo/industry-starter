// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// The home layout when no Contentools page is published (or Contentools is down): the hero with the finder, the category tiles
// and the popular products, in the design's order. The blocks fall back to their localized defaults; they must be rendered inside
// a HomeDataProvider (the home page provides one). Sections carry their own 48 px rhythm (`py-5` twice).
import { AutomotiveHero } from '@/components/home/AutomotiveHero';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { PopularProducts } from '@/components/home/PopularProducts';

export function DefaultHome() {
  return (
    <>
      <AutomotiveHero showFinder />
      <div className="py-5">
        <CategoryTiles />
        <PopularProducts />
      </div>
    </>
  );
}
