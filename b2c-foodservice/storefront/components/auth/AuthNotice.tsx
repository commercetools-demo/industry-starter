import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AuthNoticeProps {
  kind: 'error' | 'success';
  children: ReactNode;
  className?: string;
}

/** Page-level message: `role="alert"` for errors, `role="status"` for success. Tinted with token alpha, no hex. */
export default function AuthNotice({ kind, children, className }: AuthNoticeProps) {
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-4 rounded-field px-4 py-3 text-[13.5px] font-medium',
        kind === 'error' ? 'bg-danger/8 text-danger-text' : 'bg-teal/8 text-teal-text',
        className,
      )}
    >
      {children}
    </div>
  );
}
