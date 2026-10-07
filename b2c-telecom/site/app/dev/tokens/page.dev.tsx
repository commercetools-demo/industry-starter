// Development-only route (/dev/tokens): the `.dev.tsx` extension is a page extension only in `next dev` (see next.config.ts).
// English only on purpose: it is a developer reference for the design tokens, not a storefront page.
import type { ReactNode } from 'react';

const BRAND_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const NEUTRAL_STEPS = ['0', '50', '100', '200', '300', '400', '500', '600', '700', '900'];
const SEMANTIC_COLORS = [
  'text',
  'text-muted',
  'text-on-brand',
  'text-on-pink',
  'text-link',
  'surface',
  'surface-subtle',
  'surface-brand',
  'surface-brand-subtle',
  'border',
  'border-brand',
  'border-on-brand',
  'action',
  'action-hover',
];
const COLOR_GROUPS: { title: string; names: string[] }[] = [
  { title: 'Brand (Honey Locust)', names: BRAND_STEPS.map((step) => `brand-${step}`) },
  { title: 'Pink (After-Party Pink)', names: BRAND_STEPS.map((step) => `pink-${step}`) },
  { title: 'Neutral', names: NEUTRAL_STEPS.map((step) => `neutral-${step}`) },
  { title: 'Semantic', names: SEMANTIC_COLORS },
  { title: 'Storefront extensions', names: ['danger', 'overlay'] },
];

// Literal class strings so Tailwind generates every utility.
const TEXT_SIZES = [
  { name: '--text-xs', className: 'text-xs' },
  { name: '--text-sm', className: 'text-sm' },
  { name: '--text-md', className: 'text-md' },
  { name: '--text-lg', className: 'text-lg' },
  { name: '--text-xl', className: 'text-xl' },
  { name: '--text-2xl', className: 'text-2xl' },
  { name: '--text-3xl', className: 'text-3xl' },
  { name: '--text-4xl', className: 'text-4xl' },
  { name: '--text-5xl', className: 'text-5xl' },
];
const RADII = [
  { name: 'rounded-sm', className: 'rounded-sm' },
  { name: 'rounded-md', className: 'rounded-md' },
  { name: 'rounded-lg', className: 'rounded-lg' },
  { name: 'rounded-xl', className: 'rounded-xl' },
  { name: 'rounded-pill', className: 'rounded-pill' },
];
const SHADOWS = [
  { name: 'shadow-sm', className: 'shadow-sm' },
  { name: 'shadow-md', className: 'shadow-md' },
  { name: 'shadow-lg', className: 'shadow-lg' },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mb-9">
      <h2 className="font-display text-4xl font-semibold mb-5">{title}</h2>
      {children}
    </section>
  );
}

export default function TokensPage() {
  return (
    <main className="mx-auto w-full max-w-[var(--container-width)] p-5 font-body text-text">
      <h1 className="font-display text-5xl font-bold mb-7">Design tokens</h1>

      <Section id="colors" title="Colors">
        {COLOR_GROUPS.map((group) => (
          <div key={group.title} className="mb-6">
            <h3 className="font-display text-xl font-semibold mb-3">{group.title}</h3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
              {group.names.map((name) => (
                <li key={name} className="border border-border rounded-md overflow-hidden">
                  <div className="h-9" style={{ backgroundColor: `var(--color-${name})` }} />
                  <p className="p-3 text-xs break-all">--color-{name}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section id="type" title="Typography">
        <ul className="mb-5">
          {TEXT_SIZES.map((size) => (
            <li key={size.name} className={`font-display ${size.className}`}>
              {size.name}: Malva Telecom plans
            </li>
          ))}
        </ul>
        <p className="font-display text-xl font-semibold">Exo (font-display): headings, navigation, plan names</p>
        <p className="font-cta text-xl font-extrabold">Inter (font-cta, weight 800): calls to action</p>
        <p className="font-body text-xl">Roboto (font-body): dense body copy for plan details and legal text.</p>
      </Section>

      <Section id="actions" title="Actions">
        <p className="mb-4">
          <button
            type="button"
            className="rounded-pill bg-action hover:bg-action-hover text-text-on-pink font-cta font-extrabold px-6 py-3"
          >
            Choose plan
          </button>
        </p>
        <p className="mb-4">
          <a href="#actions" className="text-text-link underline">
            Compare plans
          </a>
        </p>
        <ul className="list-disc pl-6 marker:text-action">
          <li>Unlimited data</li>
          <li>Roaming included</li>
        </ul>
      </Section>

      <Section id="brand-surfaces" title="Brand surfaces">
        <p className="on-brand bg-brand-500 text-text-on-brand p-5 mb-3">Dark text on brand-500</p>
        <p data-surface="dark" className="on-dark bg-brand-950 text-text-on-pink p-5 mb-3">
          Light text on brand-950
        </p>
        <p className="breadcrumb bg-brand-100 text-brand-900 p-5">Home / Plans / Unlimited</p>
      </Section>

      <Section id="radius-shadow" title="Radius and elevation">
        <ul className="flex flex-wrap gap-5">
          {RADII.map((radius) => (
            <li key={radius.name} className={`bg-brand-100 text-brand-900 text-xs p-5 border border-border-brand ${radius.className}`}>
              {radius.name}
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-5 mt-6">
          {SHADOWS.map((shadow) => (
            <li key={shadow.name} className={`bg-surface text-xs p-5 rounded-md ${shadow.className}`}>
              {shadow.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="danger" title="Danger">
        <label className="block">
          <span className="block text-sm mb-1">Phone number</span>
          <input type="text" aria-invalid="true" defaultValue="12" className="border border-danger rounded-md px-3 py-2 w-full max-w-xs" />
          <span className="error block text-sm text-danger mt-1">Enter a valid phone number</span>
        </label>
      </Section>
    </main>
  );
}
