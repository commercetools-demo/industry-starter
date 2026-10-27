import type { ComponentMap } from '@commercetools-labs/page-builder';
import { Banner, Cta, Hero, ImageBlock, RichText } from '@/components/page-builder/blocks/ContentBlocks';
import { ActiveFiltersBlock, BreadcrumbsBlock, FacetsBlock, PaginationBlock, ProductGridBlock, ResultHeaderBlock, SortBlock } from '@/components/page-builder/blocks/ListingBlocks';
import { FulfilmentBlock, OptionsBlock, TrustBlock } from '@/components/page-builder/blocks/ProductBlocks';
import { ProductBreadcrumbsBlock, RatingSummaryBlock, ReviewsBlock } from '@/components/page-builder/blocks/ProductServerBlocks';
import AddToBag from '@/components/pdp/AddToBag';
import BuyBoxHeader from '@/components/pdp/BuyBoxHeader';
import DetailAccordions from '@/components/pdp/DetailAccordions';
import FactsRow from '@/components/pdp/FactsRow';
import Gallery from '@/components/pdp/Gallery';
import { CategoryTiles, EditorialStrip, ProductStrip, SubscribeStrip } from '@/components/page-builder/blocks/HomeBlocks';
import { withSoftFail } from '@/lib/page-builder/soft-map';

/** Catalog type key to component. Every key must also be in `page-builder.catalog.json` (a test keeps the two in step). */
export const catalogComponents: ComponentMap = {
  'content/hero': Hero,
  'content/banner': Banner,
  'content/rich-text': RichText,
  'content/image': ImageBlock,
  'content/cta': Cta,
  'home/category-tiles': CategoryTiles,
  'home/editorial-strip': EditorialStrip,
  'home/subscribe-strip': SubscribeStrip,
  'product/product-strip': ProductStrip,
  'listing/result-header': ResultHeaderBlock,
  'listing/breadcrumbs': BreadcrumbsBlock,
  'listing/facets': FacetsBlock,
  'listing/sort': SortBlock,
  'listing/active-filters': ActiveFiltersBlock,
  'listing/pagination': PaginationBlock,
  'listing/product-grid': ProductGridBlock,
  'product/related-strip': ProductStrip,
  'product/breadcrumbs': ProductBreadcrumbsBlock,
  'product/gallery': Gallery,
  'product/header': BuyBoxHeader,
  'product/facts': FactsRow,
  'product/options': OptionsBlock,
  'product/fulfilment': FulfilmentBlock,
  'product/add-to-bag': AddToBag,
  'product/trust': TrustBlock,
  'product/details': DetailAccordions,
  'product/rating': RatingSummaryBlock,
  'product/reviews': ReviewsBlock,
};

/** What the routes pass to the shim: the map above, with unknown types skipped and logged. */
export const components: ComponentMap = withSoftFail(catalogComponents);
