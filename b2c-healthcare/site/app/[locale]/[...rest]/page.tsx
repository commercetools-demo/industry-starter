import { notFound } from 'next/navigation';

// Catch-all: an unmatched /<locale>/... address renders `../not-found.tsx` inside the shell with a
// 404 status, instead of Next's default 404 without the header and footer.
export default function CatchAll(): never {
  notFound();
}
