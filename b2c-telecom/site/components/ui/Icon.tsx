import type { ReactElement, ReactNode } from 'react';

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function MenuIcon({ className }: IconProps): ReactElement {
  return (
    <Svg className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

export function CloseIcon({ className }: IconProps): ReactElement {
  return (
    <Svg className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function CheckIcon({ className }: IconProps): ReactElement {
  return (
    <Svg className={className}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Svg>
  );
}

export function ChevronRightIcon({ className }: IconProps): ReactElement {
  return (
    <Svg className={className}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}

export function SpinnerIcon({ className }: IconProps): ReactElement {
  return (
    <Svg className={className}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </Svg>
  );
}
