import { notFound } from 'next/navigation';

/** Unmatched URLs under a valid locale render the localized not-found page. */
export default function CatchAllPage(): never {
  notFound();
}
