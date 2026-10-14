// GET /api/store/preview-pages (workstream U-06): the pages of the theme preview with their storefront URLs, and whether each one
// exists yet (a short HEAD probe of the storefront; a 404 or no answer means "Storefront page not available yet"). The Product
// page uses a real part of the store's assortment. Admin only; the store is the session's.
import { findPreviewProductSlug } from '@/lib/ct/preview-product';
import { authorizeRequest, storeHandle } from '@/lib/portal/store-route';
import { json } from '@/lib/portal/route-kit';
import { readSession } from '@/lib/portal/seam';
import { storefrontOrigin } from '@/lib/portal/storefront-origin';
import { PREVIEW_PAGES, previewUrl, type PreviewPageStatus } from '@/lib/portal/storefront-urls';

const PROBE_TIMEOUT_MS = 1500;

async function probe(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    return response.status !== 404 && response.status < 500;
  } catch {
    return false;
  }
}

export const GET = storeHandle(async (request: Request) => {
  const session = await readSession();
  const { storeKey } = await authorizeRequest(session.storeKey, 'store.view');
  const locale = new URL(request.url).searchParams.get('locale') === 'en-US' ? 'en-US' : 'de-DE';
  const origin = storefrontOrigin();
  const slug = await findPreviewProductSlug(storeKey, locale);
  const pages: PreviewPageStatus[] = await Promise.all(
    PREVIEW_PAGES.map(async (id) => {
      const url = previewUrl(origin, locale, storeKey, id, slug);
      return { id, url, available: url !== null && origin !== '' && (await probe(url)) };
    }),
  );
  return json({ pages });
});
