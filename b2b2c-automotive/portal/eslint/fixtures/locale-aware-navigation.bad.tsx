import Link from 'next/link';
import { redirect, useRouter } from 'next/navigation';

export function Nav() {
  const router = useRouter();
  if (!router) redirect('/');
  return <Link href="/">Home</Link>;
}
