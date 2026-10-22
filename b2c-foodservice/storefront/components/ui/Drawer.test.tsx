import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import Drawer from './Drawer';
import Modal from './Modal';

function DrawerHarness({ initiallyOpen = false }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open bag</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Your bag" footer={<button>Checkout</button>}>
        <button>First item</button>
        <button>Last item</button>
      </Drawer>
    </>
  );
}

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open store</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Choose a store">
        <button>Pick</button>
      </Modal>
    </>
  );
}

describe('Drawer', () => {
  it('Drawer opens with focus inside and a dialog role', async () => {
    renderWithIntl(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open bag' }));
    const dialog = screen.getByRole('dialog', { name: 'Your bag' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape closes the drawer', async () => {
    renderWithIntl(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open bag' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Tab is trapped inside the drawer', async () => {
    renderWithIntl(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open bag' }));
    const dialog = screen.getByRole('dialog');
    for (let i = 0; i < 8; i++) {
      await userEvent.tab();
      expect(dialog.contains(document.activeElement), `tab ${i}`).toBe(true);
    }
    for (let i = 0; i < 8; i++) {
      await userEvent.tab({ shift: true });
      expect(dialog.contains(document.activeElement), `shift tab ${i}`).toBe(true);
    }
  });

  it('Focus returns to the opener on close', async () => {
    renderWithIntl(<DrawerHarness />);
    const opener = screen.getByRole('button', { name: 'Open bag' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('Overlay click closes', async () => {
    renderWithIntl(<DrawerHarness initiallyOpen />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('drawer-overlay'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Closed drawer is inert and not focusable', () => {
    renderWithIntl(<DrawerHarness />);
    const panel = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveAttribute('inert');
    expect(panel).toHaveAttribute('aria-hidden', 'true');
    expect(panel.className).toContain('invisible');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Body scroll is locked while open and restored', async () => {
    renderWithIntl(<DrawerHarness />);
    expect(document.body.style.overflow).toBe('');
    await userEvent.click(screen.getByRole('button', { name: 'Open bag' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('');
  });

  it('Drawer close button has a localized accessible name', async () => {
    renderWithIntl(<DrawerHarness initiallyOpen />, { locale: 'en-CA' });
    await userEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Drawer is 440px wide and slides in 320ms', () => {
    renderWithIntl(<DrawerHarness initiallyOpen />);
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain('w-[min(440px,100vw)]');
    expect(cls).toContain('transition-drawer');
    expect(cls).toContain('right-0');
  });

  it('Drawer renders a sticky footer slot', () => {
    renderWithIntl(<DrawerHarness initiallyOpen />);
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('Modal title labels the dialog', async () => {
    renderWithIntl(<ModalHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open store' }));
    expect(screen.getByRole('dialog', { name: 'Choose a store' })).toBeInTheDocument();
  });

  it('Modal is 560px with a 24px radius', async () => {
    renderWithIntl(<ModalHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open store' }));
    const cls = screen.getByRole('dialog').className;
    expect(cls).toContain('w-[min(560px,94vw)]');
    expect(cls).toContain('rounded-panel');
  });

  it('Modal closes with Escape and returns focus, and its close button is localized', async () => {
    renderWithIntl(<ModalHarness />, { locale: 'en-CA' });
    const opener = screen.getByRole('button', { name: 'Open store' });
    await userEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Close dialogue' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('focus goes back to the button that opened the dialog even when the browser did not focus it on click (Safari, found by Q)', async () => {
    renderWithIntl(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Open store' });
    // fireEvent.click does not move focus, like a click on a button in Safari; the pointer event comes first in a real tap
    fireEvent.pointerDown(opener);
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(opener).not.toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('a closing dialog gets aria-hidden only after focus has left it (the browser blocks aria-hidden on a focused subtree, found by Q)', async () => {
    renderWithIntl(<ModalHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open store' }));
    const panel = screen.getByRole('dialog');
    expect(panel.contains(document.activeElement)).toBe(true);
    const violations: string[] = [];
    const original = panel.setAttribute.bind(panel);
    panel.setAttribute = (name: string, value: string) => {
      if (name === 'aria-hidden' && value === 'true' && panel.contains(document.activeElement)) violations.push('aria-hidden set while focus is inside');
      original(name, value);
    };
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'true'));
    expect(violations).toEqual([]);
  });

  it('the same for the drawer', async () => {
    renderWithIntl(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open bag' }));
    const panel = screen.getByRole('dialog');
    const violations: string[] = [];
    const original = panel.setAttribute.bind(panel);
    panel.setAttribute = (name: string, value: string) => {
      if (name === 'aria-hidden' && value === 'true' && panel.contains(document.activeElement)) violations.push('aria-hidden set while focus is inside');
      original(name, value);
    };
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(panel).toHaveAttribute('aria-hidden', 'true'));
    expect(violations).toEqual([]);
  });
});
