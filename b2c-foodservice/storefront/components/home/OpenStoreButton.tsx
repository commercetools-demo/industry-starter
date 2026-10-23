'use client';

import type { ReactNode } from 'react';
import Button, { type ButtonProps } from '@/components/ui/Button';
import Icon from '@/components/ui/Icon';
import { useCollectionStore } from '@/hooks/useCollectionStore';

/** The one interactive leaf of the home page: opens the store picker (workstream F). */
export default function OpenStoreButton({
  children,
  variant,
  size,
  block,
  className,
  pin = true,
}: {
  children: ReactNode;
  pin?: boolean;
} & Pick<ButtonProps, 'variant' | 'size' | 'block' | 'className'>) {
  const { open } = useCollectionStore();
  return (
    <Button type="button" variant={variant} size={size} block={block} className={className} onClick={() => open()}>
      {pin ? <Icon name="pin" size={18} /> : null}
      {children}
    </Button>
  );
}
