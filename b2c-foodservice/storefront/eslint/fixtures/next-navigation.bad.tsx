'use client';
import { useRouter } from 'next/navigation';

export default function Back() {
  const router = useRouter();
  return (
    <button type="button" onClick={() => router.back()}>
      Back
    </button>
  );
}
