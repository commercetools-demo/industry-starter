import { notFound } from 'next/navigation';

export default function Page({ found }: { found: boolean }) {
  if (!found) notFound();
  return <main />;
}
