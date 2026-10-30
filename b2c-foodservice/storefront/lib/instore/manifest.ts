import type { MetadataRoute } from 'next';

/**
 * Web app manifest of the In-store companion (workstream R): lets a shopper add it to the phone's home screen. A manifest needs
 * literal colours (it is not CSS), so these two mirror the tokens `--canvas` and `--ink`; `manifest.test.ts` fails when
 * `app/tokens.css` changes and these do not.
 */
export const MANIFEST_COLOURS = { background: '#FBF9F5', theme: '#191741' } as const;

export function instoreManifest(): MetadataRoute.Manifest {
  return {
    name: 'Malva Coffee In-store',
    short_name: 'Malva In-store',
    description: 'Scan a barcode, check a product, pay from your phone.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: MANIFEST_COLOURS.background,
    theme_color: MANIFEST_COLOURS.theme,
    icons: [{ src: '/instore-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
