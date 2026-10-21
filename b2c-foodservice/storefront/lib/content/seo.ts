import type { Metadata } from 'next';

/** Site origin for canonical links, the sitemap and robots.txt. Not a secret; falls back to the Netlify URL, then localhost. */
export function siteOrigin(env: Record<string, string | undefined> = process.env): string {
  const raw = env.NEXT_PUBLIC_SITE_URL || env.URL || env.DEPLOY_PRIME_URL || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

interface PageMetaInput {
  locale: string;
  /** Path without locale, for example `/about`. */
  path: string;
  title: string;
  description: string;
  /** Locales that have their own text; a fallback locale is not advertised as an alternate. */
  ownLocales?: string[];
  openGraph?: NonNullable<Metadata['openGraph']>;
}

export function pageMetadata({ locale, path, title, description, ownLocales = [locale], openGraph }: PageMetaInput): Metadata {
  return {
    metadataBase: new URL(siteOrigin()),
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: Object.fromEntries(ownLocales.map((l) => [l, `/${l}${path}`])),
    },
    openGraph: { title, description, url: `/${locale}${path}`, ...openGraph },
  };
}
