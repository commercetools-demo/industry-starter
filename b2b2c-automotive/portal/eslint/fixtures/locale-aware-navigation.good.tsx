import { notFound, useSearchParams } from 'next/navigation';
import { Link, redirect, useRouter } from '@/i18n/routing';

export function Nav() {
  const router = useRouter();
  const params = useSearchParams();
  if (!router) redirect('/');
  if (!params) notFound();
  return <Link href="/">Home</Link>;
}
