'use client';

// Last-resort boundary: replaces the root layout, so it carries its own html and body and no styles it depends on.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de-DE">
      <body>
        <h1>Etwas ist schiefgelaufen / Something went wrong</h1>
        <button type="button" onClick={reset}>
          Erneut versuchen / Try again
        </button>
      </body>
    </html>
  );
}
