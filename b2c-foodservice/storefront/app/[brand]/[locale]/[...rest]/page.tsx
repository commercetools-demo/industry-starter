import { notFound } from 'next/navigation';

/** Unmatched paths under a valid locale render the localized 404 with the shell (known next-intl pattern). */
export default function CatchAllPage() {
  notFound();
}
