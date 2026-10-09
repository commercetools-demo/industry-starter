'use client';
import messages from '@/messages/en-US.json';

/** Last resort when the root layout itself fails: it renders its own document, English only, plain links. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = messages.errors;
  return (
    <html lang="en-US">
      <body>
        <main style={{ padding: 32 }}>
          <h1>{t.title}</h1>
          <p>{t.body}</p>
          <button type="button" onClick={reset}>{t.retry}</button>
          {/* A full reload is deliberate: the router may be what failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <p><a href="/en-US/plumbing">{t.browsePlumbing}</a> · <a href="/en-US/waste-management">{t.browseWaste}</a> · <a href="/en-US/request-a-quote">{t.requestQuote}</a></p>
        </main>
      </body>
    </html>
  );
}
