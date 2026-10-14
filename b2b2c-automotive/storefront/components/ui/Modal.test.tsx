// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open it</button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        labelledBy="t"
      >
        <h2 id="t">Choose your store</h2>
        <button>Inside</button>
      </Modal>
    </>
  );
}

describe('Keyboard and screen reader use: Modal', () => {
  it('opens with showModal', async () => {
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(show).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('dialog', { name: 'Choose your store' })).toBeInTheDocument();
    show.mockRestore();
  });
  it('closes on Escape and calls onClose', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('restores focus to the opener', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });
  it('closes on a click on the backdrop but not on the content', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    await userEvent.click(screen.getByRole('button', { name: 'Inside' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(document.querySelector('dialog')!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('has no axe violations', async () => {
    const { container } = render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open it' }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
