'use client';

import { useId, useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Radio } from '@/components/ui/Radio';
import { Segmented } from '@/components/ui/Segmented';
import { cx } from '@/components/ui/cx';
import { usePathname, useRouter } from '@/i18n/routing';
import { VARIANT_CONFIG, type Selector } from '@/lib/config/variant-config';

/**
 * One control per selector from `buildSelectors` (segmented, swatch circles or radios, per the variant config).
 * Choosing an option replaces the URL with `?sku=<variant sku>` (no scroll); the server page then re-renders with that
 * variant. The choice shows at once through an optimistic value while the navigation is pending.
 */
export function VariantSelectors({ selectors }: { selectors: Selector[] }) {
  const t = useTranslations('pdp');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useOptimistic<Record<string, string>, Record<string, string>>({}, (state, next) => ({ ...state, ...next }));
  const groupId = useId();

  if (selectors.length === 0) return null;

  const choose = (selector: Selector, value: string) => {
    const sku = selector.options.find((o) => o.value === value)?.sku;
    if (!sku || value === (chosen[selector.name] ?? selector.selected)) return;
    startTransition(() => {
      setChosen({ [selector.name]: value });
      router.replace(`${pathname}?sku=${encodeURIComponent(sku)}`, { scroll: false });
    });
  };

  return (
    <div className="grid gap-(--space-4)" aria-busy={pending}>
      {selectors.map((selector) => {
        const label = t.has(`options.${selector.name}`) ? t(`options.${selector.name}`) : selector.label;
        const selected = chosen[selector.name] ?? selector.selected;
        const labelId = `${groupId}-${selector.name}`;
        return (
          <div key={selector.name} data-selector={selector.name}>
            <div className="mb-(--space-2) flex items-baseline justify-between gap-(--space-3)">
              <h6 id={labelId} className="m-0">
                {label}
              </h6>
              {selector.kind === 'swatch' ? <span className="text-[14px] text-muted">{selected}</span> : null}
            </div>
            {selector.kind === 'segmented' ? (
              <Segmented
                label={label}
                name={`${groupId}-${selector.name}`}
                value={selected}
                onChange={(value) => choose(selector, value)}
                options={selector.options.map((o) => ({ value: o.value, label: o.label, disabled: o.disabled }))}
              />
            ) : (
              <div role="radiogroup" aria-labelledby={labelId} className={cx('flex flex-wrap', selector.kind === 'swatch' ? 'gap-(--space-2)' : 'gap-x-(--space-4) gap-y-(--space-2)')}>
                {selector.options.map((option) =>
                  selector.kind === 'swatch' ? (
                    <label
                      key={option.value}
                      className={cx(
                        'relative inline-flex size-11 cursor-pointer items-center justify-center rounded-full has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent',
                        option.disabled && 'cursor-not-allowed opacity-45',
                      )}
                    >
                      <input
                        type="radio"
                        className="peer absolute opacity-0"
                        name={`${groupId}-${selector.name}`}
                        value={option.value}
                        checked={option.value === selected}
                        disabled={option.disabled}
                        aria-label={option.label}
                        onChange={() => choose(selector, option.value)}
                      />
                      <span
                        aria-hidden="true"
                        className="size-9 rounded-full border border-divider ring-offset-2 ring-offset-bg peer-checked:ring-2 peer-checked:ring-accent"
                        style={{ backgroundColor: VARIANT_CONFIG.swatch[selector.name]?.[option.value] }}
                      />
                    </label>
                  ) : (
                    <Radio
                      key={option.value}
                      name={`${groupId}-${selector.name}`}
                      value={option.value}
                      label={option.label}
                      checked={option.value === selected}
                      disabled={option.disabled}
                      onChange={() => choose(selector, option.value)}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
