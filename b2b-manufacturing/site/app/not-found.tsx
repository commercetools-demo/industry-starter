import Link from 'next/link';
import messages from '@/messages/en-US.json';

// Reached for unknown paths and unsupported locales. It renders its own document because the root layout does not.
export default function NotFound() {
  return (
    <html lang="en-US">
      <body>
        <main>
          <h1>{messages.notFound.title}</h1>
          <p>{messages.notFound.body}</p>
          <Link href="/">{messages.notFound.home}</Link>
        </main>
      </body>
    </html>
  );
}
