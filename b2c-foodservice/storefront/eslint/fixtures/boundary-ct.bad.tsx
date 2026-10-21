'use client';
import { apiRoot } from '@/lib/ct/client';

export default function Widget() {
  return <span>{String(Boolean(apiRoot))}</span>;
}
