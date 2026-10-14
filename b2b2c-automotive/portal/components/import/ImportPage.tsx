'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useTablist } from '@/hooks/useTablist';
import { CsvImport } from './CsvImport';
import { LocalProductForm } from './LocalProductForm';
import { LocalProductList } from './LocalProductList';

export type ImportTab = 'add' | 'csv' | 'local';
const TABS: ImportTab[] = ['add', 'csv', 'local'];

/** Product import (workstream W): three tabs. `initialTab` and `highlightKey` come from the URL (`?tab=local&key=...`). */
export function ImportPage({ initialTab = 'add', highlightKey }: { initialTab?: ImportTab; highlightKey?: string }) {
  const t = useTranslations('importPage');
  const [tab, setTab] = useState<ImportTab>(initialTab);
  const { listProps, tabProps } = useTablist<ImportTab>({ ids: TABS, value: tab, onChange: setTab, withPanel: false });

  return (
    <div className="flex flex-col gap-400">
      <div role="tablist" aria-label={t('tabsLabel')} {...listProps} className="flex w-max max-w-full gap-100 overflow-x-auto rounded-300 bg-bg-surface-subdued p-100">
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            {...tabProps(id)}
            id={`import-tab-${id}`}
            aria-controls={`import-panel-${id}`}
            className={`inline-flex h-1000 items-center whitespace-nowrap rounded-200 px-400 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${tab === id ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'}`}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`import-panel-${tab}`} aria-labelledby={`import-tab-${tab}`}>
        {tab === 'add' ? <LocalProductForm /> : tab === 'csv' ? <CsvImport /> : <LocalProductList highlightKey={highlightKey} />}
      </div>
    </div>
  );
}
