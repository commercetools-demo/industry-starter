import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ConfirmDialog } from '@/components/catalog/ConfirmDialog';
import { Dialog } from './Dialog';

function DialogHost({ variant }: { variant?: 'modal' | 'drawer' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Dialog open={open} title="Edit branch" variant={variant} onClose={() => setOpen(false)} footer={<button type="button" onClick={() => setOpen(false)}>Done</button>}>
        <label>
          Name
          <input defaultValue="Hamburg" />
        </label>
      </Dialog>
    </>
  );
}

function ConfirmHost() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Withdraw
      </button>
      <ConfirmDialog open={open} title="Withdraw offer" confirmLabel="Withdraw" cancelLabel="Cancel" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)}>
        <p>This cannot be undone.</p>
      </ConfirmDialog>
    </>
  );
}

describe('dialog focus trap and return', () => {
  for (const variant of ['modal', 'drawer'] as const) {
    it(`${variant}: focus moves in, Tab cycles inside, Escape closes and focus returns to the trigger`, async () => {
      const user = userEvent.setup();
      render(<DialogHost variant={variant} />);
      const trigger = screen.getByRole('button', { name: 'Open dialog' });
      await user.click(trigger);
      const dialog = screen.getByRole('dialog', { name: 'Edit branch' });
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      await user.tab();
      await user.tab();
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  }

  it('closing with the footer button also returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<DialogHost />);
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(trigger).toHaveFocus();
  });

  it('confirm dialog: focus returns to the trigger on Escape and on Cancel', async () => {
    const user = userEvent.setup();
    render(<ConfirmHost />);
    const trigger = screen.getByRole('button', { name: 'Withdraw' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Withdraw offer' })).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(trigger).toHaveFocus();
  });
});

describe('a11y: Dialog', () => {
  it('has no axe violations open as modal, drawer and confirm dialog', async () => {
    const user = userEvent.setup();
    const modal = render(<DialogHost />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await axe(modal.container)).toHaveNoViolations();
    expect(await axe(screen.getByRole('dialog'))).toHaveNoViolations();
    modal.unmount();
    const drawer = render(<DialogHost variant="drawer" />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    expect(await axe(drawer.container)).toHaveNoViolations();
    drawer.unmount();
    const confirm = render(<ConfirmHost />);
    await user.click(screen.getByRole('button', { name: 'Withdraw' }));
    expect(await axe(confirm.container)).toHaveNoViolations();
  });
});
