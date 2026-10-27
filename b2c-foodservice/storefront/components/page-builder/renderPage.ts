import 'server-only';
import { createElement, Fragment, type ReactNode } from 'react';
import { PageBuilderRoute, type PageBuilderRouteProps } from '@/components/page-builder/PageBuilderRoute';

/**
 * What a route learns from the page builder: an authored page to draw, "no page" (the service answered `page_not_found`), or a
 * failure (down, slow, misconfigured). The shim returns the very `fallback` node it is given, so two marker nodes tell the
 * outcomes apart by identity and the route chooses what each one means (native page, real not-found, degraded page) without
 * building that fallback up front. Failures are already logged by the shim.
 */
export type PageOutcome = { kind: 'page'; node: ReactNode } | { kind: 'none' } | { kind: 'failed' };

const NONE = createElement(Fragment, { key: 'pb-none' });
const FAILED = createElement(Fragment, { key: 'pb-failed' });

export async function renderPage(props: Omit<PageBuilderRouteProps, 'fallback' | 'errorFallback'>): Promise<PageOutcome> {
  const node = await PageBuilderRoute({ ...props, fallback: NONE, errorFallback: FAILED });
  if (node === NONE) return { kind: 'none' };
  if (node === FAILED) return { kind: 'failed' };
  return { kind: 'page', node };
}
