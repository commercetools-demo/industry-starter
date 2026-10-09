'use client';
import { useSearchParams } from 'next/navigation';
import { SignInForm } from '@/components/auth/SignInForm';

/** Reads `?next=` in the browser so the page itself stays static. */
export function SignInClient() {
  return <SignInForm next={useSearchParams().get('next')} autoFocus />;
}
