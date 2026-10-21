import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  as?: 'div' | 'section' | 'article';
}

export default function Card({ as: Tag = 'div', className, ...props }: CardProps) {
  return <Tag className={cn('rounded-card border border-line bg-surface p-6', className)} {...props} />;
}
