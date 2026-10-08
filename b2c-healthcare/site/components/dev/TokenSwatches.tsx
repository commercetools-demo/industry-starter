// Dev-only reference sheet of the design tokens (rendered by app/[locale]/_tokens/page.tsx in workstream H).
// Everything is styled through tokens; nothing here is a product string.

const SCALES = {
  brand: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  navy: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  neutral: [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 900],
} as const;

const STATUSES = ['success', 'warning', 'info', 'danger'] as const;
const TEXT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;
const RADII = ['sm', 'md', 'lg', 'xl', '2xl', 'pill'] as const;
const SHADOWS = ['sm', 'md', 'lg'] as const;
const FONTS = [
  ['display', 'Poppins: headings, nav, buttons'],
  ['meta', 'Lato: experience, ratings, filters'],
  ['body', 'Roboto: footer copy'],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10" aria-labelledby={`tok-${title}`}>
      <h2 id={`tok-${title}`} className="mb-4 font-display text-xl font-semibold text-text-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span
        aria-hidden="true"
        className="inline-block size-10 shrink-0 rounded-sm border border-border"
        style={{ background: `var(${token})` }}
      />
      <code>{token}</code>
    </li>
  );
}

export function TokenSwatches() {
  return (
    <div className="mx-auto max-w-content p-6 font-body text-text-body" data-testid="token-swatches">
      <h1 className="mb-8 font-display text-3xl font-semibold text-text-heading">Design tokens</h1>

      <Section title="Colors">
        {Object.entries(SCALES).map(([scale, steps]) => (
          <div key={scale} className="mb-6" data-scale={scale}>
            <h3 className="mb-2 font-display text-lg font-medium text-text">{scale}</h3>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {steps.map((step) => (
                <Swatch key={step} token={`--color-${scale}-${step}`} />
              ))}
            </ul>
          </div>
        ))}
        <div className="mb-6" data-scale="status">
          <h3 className="mb-2 font-display text-lg font-medium text-text">status</h3>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STATUSES.flatMap((s) => [50, 500, 700].map((step) => `--color-${s}-${step}`)).map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </ul>
        </div>
      </Section>

      <Section title="Type scale">
        <ul className="space-y-2">
          {FONTS.map(([name, note]) => (
            <li key={name} style={{ fontFamily: `var(--font-${name})`, fontSize: 'var(--text-lg)' }}>
              <code>--font-{name}</code> {note}
            </li>
          ))}
          {TEXT_SIZES.map((size) => (
            <li key={size} style={{ fontSize: `var(--text-${size})`, fontFamily: 'var(--font-display)' }}>
              <code>--text-{size}</code> The quick brown fox
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Radii">
        <ul className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <li key={r} className="text-center text-sm">
              <span
                aria-hidden="true"
                className="mb-1 block size-16 border border-border-brand bg-surface-brand-subtle"
                style={{ borderRadius: `var(--radius-${r})` }}
              />
              <code>--radius-{r}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Shadows">
        <ul className="flex flex-wrap gap-8">
          {SHADOWS.map((s) => (
            <li key={s} className="text-center text-sm">
              <span
                aria-hidden="true"
                className="mb-2 block size-24 rounded-lg bg-surface"
                style={{ boxShadow: `var(--shadow-${s})` }}
              />
              <code>--shadow-{s}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Status badges">
        <ul className="flex flex-wrap gap-3" data-testid="status-badges">
          {STATUSES.map((s) => (
            <li
              key={s}
              data-status={s}
              className="rounded-sm px-3 py-1 font-meta text-sm font-bold"
              style={{ background: `var(--color-${s}-50)`, color: `var(--color-${s}-700)` }}
            >
              {s}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Primary button label">
        <div className="flex flex-wrap items-start gap-6" data-testid="button-pair">
          <figure>
            <button
              type="button"
              data-label="navy"
              className="rounded-md px-5 py-3 font-display text-sm font-medium"
              style={{ background: 'var(--color-action)', color: 'var(--color-action-label)' }}
            >
              Book appointment
            </button>
            <figcaption className="mt-2 text-sm">navy-900 label on azure (chosen, 5.6:1)</figcaption>
          </figure>
          <figure>
            <button
              type="button"
              data-label="white"
              className="rounded-md px-5 py-3 font-display text-sm font-medium"
              style={{ background: 'var(--color-action)', color: 'var(--color-text-on-brand)' }}
            >
              Book appointment
            </button>
            <figcaption className="mt-2 text-sm">white label on azure (prototype, 2.6:1, fails AA)</figcaption>
          </figure>
        </div>
      </Section>
    </div>
  );
}
