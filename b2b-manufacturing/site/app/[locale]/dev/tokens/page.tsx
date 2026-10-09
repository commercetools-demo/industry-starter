import { notFound } from 'next/navigation';

// Visual smoke page for the design tokens and component classes. Development only: scripts/check-no-dev-pages.mjs
// requires this guard in every file under a `dev/` route.
export default function TokensPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="wrap" style={{ paddingTop: 'var(--sp-10)', paddingBottom: 'var(--sp-10)' }}>
      <h1>Design tokens</h1>
      <section style={{ marginTop: 'var(--sp-8)' }}>
        <h2>Buttons</h2>
        <div className="row" style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', marginTop: 'var(--sp-4)' }}>
          <button className="btn">Primary</button>
          <button className="btn o">Outline</button>
          <button className="btn sm">Small</button>
          <span style={{ background: 'var(--sl-ink-2)', padding: 'var(--sp-4)', display: 'flex', gap: 'var(--sp-4)' }}>
            <button className="btn w">White</button>
            <button className="btn ow">Outline white</button>
          </span>
        </div>
      </section>
      <section style={{ marginTop: 'var(--sp-8)' }}>
        <h2>Card, tag and input</h2>
        <div className="grid g3" style={{ marginTop: 'var(--sp-4)' }}>
          <article className="card">
            <div className="b">
              <span className="tag">Plumbing</span>
              <h3>Service card</h3>
              <p>Sentence that describes the service.</p>
              <span className="more">Learn more</span>
            </div>
          </article>
          <label className="f">
            Work email
            <input type="email" placeholder="name@company.com" />
          </label>
        </div>
      </section>
      <section style={{ marginTop: 'var(--sp-8)' }}>
        <h2>Type</h2>
        <p className="display">Display 48 / Inter Display</p>
        <h3>Heading 20 / Inter</h3>
        <p>Body text in Inter.</p>
        <code>mono stack</code>
      </section>
    </main>
  );
}
