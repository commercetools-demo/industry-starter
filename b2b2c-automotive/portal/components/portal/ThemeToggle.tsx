/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons/Icon';
import { useTheme } from '@/context/ThemeContext';

export function ThemeToggle() {
  const t = useTranslations('shell');
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      data-testid="toggle-theme"
      aria-label={t('themeButton')}
      title={t('themeButton')}
      aria-pressed={theme === 'dark'}
      onClick={toggle}
      className="grid size-1100 flex-none place-items-center rounded-full text-text-on hover:bg-bg-brand-hover"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
