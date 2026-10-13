'use client';

import { useId, type ReactNode } from 'react';

/** One KPI tile of the V screens: label, value and an optional note. */
export function KpiTile({ id, label, value, note }: { id: string; label: string; value: string; note?: string }) {
  return (
    <section data-testid={`kpi-${id}`} aria-label={label} className="flex flex-col gap-100 rounded-200 bg-bg-surface p-400 shadow-card">
      <h3 className="text-caption-1 font-semibold text-text-subdued">{label}</h3>
      <p data-testid={`kpi-${id}-value`} className="text-h5 font-bold text-text">
        {value}
      </p>
      {note ? <p className="text-caption-1 font-medium text-text-subdued">{note}</p> : null}
    </section>
  );
}

/** A tab strip that switches content on the same page (state, not routes). */
export function StateTabs<T extends string>({ tabs, value, onChange, ariaLabel }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; ariaLabel: string }) {
  const base = useId();
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex w-max gap-100 rounded-300 bg-bg-surface-subdued p-100">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          id={`${base}-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`inline-flex h-1000 items-center whitespace-nowrap rounded-200 px-400 text-body-2 font-semibold focus-visible:outline-2 focus-visible:outline-border-active ${
            value === tab.id ? 'bg-bg-surface text-text shadow-button' : 'text-text-subdued hover:text-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** Card with a table scrolling horizontally inside it. */
export function TableCard({ children, caption }: { children: ReactNode; caption?: ReactNode }) {
  return (
    <div className="rounded-200 bg-bg-surface p-200 shadow-card">
      <div className="overflow-x-auto">{children}</div>
      {caption ? <p className="px-300 py-250 text-caption-1 font-medium text-text-subdued">{caption}</p> : null}
    </div>
  );
}
