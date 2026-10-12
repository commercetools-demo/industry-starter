'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '@/components/ui/icons/Icon';
import { useRouter } from '@/i18n/routing';
import { useOverlay } from '@/context/OverlayContext';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { useSwitchUnit, useUnits } from '@/hooks/useUnits';
import type { StoreMode } from '@/lib/portal/types';

/** `{unit name} · {store name}` (for example "Test Garage Nord · DACH Online"). */
export const switcherLabel = (unitName: string, storeName: string) => `${unitName} · ${storeName}`;

/**
 * Top-bar switcher listing the company and its divisions plus the stores of the current unit. Choosing one writes the
 * session once on the server, refreshes every unit-scoped SWR key, re-renders the shell and confirms with a toast.
 */
export function BusinessUnitSwitcher() {
  const t = useTranslations('shell');
  const viewer = useViewer();
  const overlay = useOverlay();
  const router = useRouter();
  const { toast } = useToast();
  const switchTo = useSwitchUnit();
  const open = overlay.isOpen('bu');
  const { data, isLoading } = useUnits(open, viewer.businessUnitKey);
  const current = data?.units.find((u) => u.key === viewer.businessUnitKey);
  const modeLabel = (mode: StoreMode) => (mode === 'FromParent' ? t('storeFromParent') : t('storeExplicit'));

  async function choose(businessUnitKey: string, storeKey: string | undefined, name: string) {
    const result = await switchTo(businessUnitKey, storeKey);
    overlay.close('bu');
    if (!result.ok) {
      toast(t('switchFailed'));
      return;
    }
    toast(t('switched', { name: result.name ?? name }));
    router.refresh();
  }

  const row = 'flex h-1100 w-full items-center justify-between gap-200 rounded-300 px-300 text-left text-body-1 font-semibold text-text hover:bg-bg-surface-hover';
  return (
    <div className="relative min-w-0 narrow:flex-1">
      <button
        type="button"
        data-testid="switcher"
        title={t('switcherTitle')}
        aria-label={`${t('switcherTitle')}: ${switcherLabel(viewer.businessUnitName, viewer.storeName)}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => overlay.toggle('bu', e.currentTarget)}
        className="flex h-1100 max-w-full items-center gap-150 rounded-300 border border-border-on px-350 narrow:w-full narrow:justify-between text-body-2 font-semibold whitespace-nowrap text-text-on hover:bg-bg-brand-hover"
      >
        <span className="truncate">{switcherLabel(viewer.businessUnitName, viewer.storeName)}</span>
        <Icon name="chevron" size="sm" />
      </button>
      {open ? (
        <section role="dialog" aria-label={t('switcherTitle')} className="absolute right-0 top-full z-60 mt-200 flex w-widget-desktop-4col max-w-[calc(100vw-var(--space-800))] flex-col gap-200 rounded-400 bg-bg-surface p-400 text-text shadow-popover narrow:fixed narrow:inset-x-300 narrow:top-topbar narrow:w-auto narrow:max-w-none">
          <h2 className="text-caption-1 font-semibold uppercase text-text-subdued">{t('switcherUnits')}</h2>
          {isLoading && !data ? <p className="text-caption-1 text-text-subdued">…</p> : null}
          {data?.units.map((unit) => (
            <button
              key={unit.key}
              type="button"
              aria-current={unit.key === viewer.businessUnitKey ? 'true' : undefined}
              onClick={() => choose(unit.key, undefined, unit.name)}
              className={`${row} ${unit.key === viewer.businessUnitKey ? 'bg-bg-surface-hover' : ''}`}
            >
              <span className="truncate">{unit.name}</span>
              <span className="flex-none text-caption-1 font-medium text-text-subdued">{unit.kind === 'Company' ? t('unitCompany') : t('unitDivision')}</span>
            </button>
          ))}
          {current ? (
            <>
              <h2 className="mt-200 text-caption-1 font-semibold uppercase text-text-subdued">{t('switcherStores')}</h2>
              {current.stores.map((store) => (
                <button
                  key={store.key}
                  type="button"
                  aria-current={store.key === viewer.storeKey ? 'true' : undefined}
                  onClick={() => choose(current.key, store.key, current.name)}
                  className={`${row} ${store.key === viewer.storeKey ? 'bg-bg-surface-hover' : ''}`}
                >
                  <span className="truncate">{store.name}</span>
                  <span className="flex-none text-caption-1 font-medium text-text-subdued">{modeLabel(store.mode)}</span>
                </button>
              ))}
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
