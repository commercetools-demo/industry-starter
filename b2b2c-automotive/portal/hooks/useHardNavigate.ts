/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { hardNavigate } from './navigate';

/**
 * Full page load to a locale-less path. Used when the signed-in identity changes (sign in, sign out, demo login): the
 * client router cache would otherwise keep showing the previous user's shell for a route it already visited.
 */
export function useHardNavigate() {
  const locale = useLocale();
  return useCallback((path: string) => hardNavigate(`/${locale}${path === '/' ? '' : path}`), [locale]);
}
