import { notFound } from 'next/navigation';

// Development-only: forces a server fault to check `error.tsx`. The folder is `%5Fboom` because Next
// treats `_boom` as private; the URL is `/<locale>/_boom`. It answers 404 in production builds.
export const dynamic = 'force-dynamic';

export default function BoomPage(): never {
  if (process.env.NODE_ENV === 'production') notFound();
  throw new Error('boom: SECRET-DETAIL that must never be rendered');
}
