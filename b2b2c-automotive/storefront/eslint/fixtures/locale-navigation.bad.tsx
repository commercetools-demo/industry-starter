// Fixture for eslint/rules.test.mjs. Not part of the app (excluded from lint and tsc).
import Link from 'next/link';
import { redirect, useRouter, usePathname } from 'next/navigation';

export const nav = [Link, redirect, useRouter, usePathname];
