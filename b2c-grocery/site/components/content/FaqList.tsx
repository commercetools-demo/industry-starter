'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import type { FaqGroup } from '@/lib/faq';

/** Disclosure list grouped by topic. One answer is open at a time; each button controls its answer region. */
export function FaqList({ groups }: { groups: FaqGroup[] }) {
  const base = useId();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="max-w-[720px]">
      {groups.map((group, g) => (
        <section key={group.topic} className="mb-(--space-6)">
          <h2 className="mb-(--space-2)">{group.topic}</h2>
          <ul className="m-0 list-none p-0">
            {group.items.map((item, i) => {
              const key = `${g}-${i}`;
              const expanded = open === key;
              const buttonId = `${base}-q-${key}`;
              const panelId = `${base}-a-${key}`;
              return (
                <li key={key} className="border-b border-[color-mix(in_srgb,var(--color-text)_12%,transparent)]">
                  <h3 className="m-0 text-[length:inherit]">
                    <button
                      type="button"
                      id={buttonId}
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setOpen(expanded ? null : key)}
                      className="flex w-full cursor-pointer items-center justify-between gap-(--space-3) border-0 bg-transparent py-(--space-3) text-left font-body text-[17px] font-semibold text-text"
                    >
                      <span>{item.q}</span>
                      <Icon icon={ChevronDown} size={20} className={expanded ? 'rotate-180' : undefined} />
                    </button>
                  </h3>
                  <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded} className="pb-(--space-3) text-[16px] leading-[1.75]">
                    {item.a.split(/\n{2,}/).map((paragraph) => (
                      <p key={paragraph} className="my-(--space-2)">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
