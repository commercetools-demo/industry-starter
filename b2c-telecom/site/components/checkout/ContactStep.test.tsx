import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeCheckout, makeState } from '@/test/fixtures/checkoutApi';
import { renderWithProviders } from '@/test/utils';

const book = vi.hoisted(() => ({ defaultService: null as { phone?: string } | null }));
vi.mock('@/hooks/useAddresses', () => ({ useAddresses: () => ({ addresses: [], defaultService: book.defaultService, defaultBilling: null, isLoading: false, error: undefined }) }));

import { ContactStep } from './ContactStep';

beforeEach(() => {
  book.defaultService = null;
});

describe('ContactStep', () => {
  it('guest: a bad email shows the inline error and Continue stays disabled; a good one is saved and continues', async () => {
    const checkout = fakeCheckout(makeState());
    const done = vi.fn();
    renderWithProviders(<ContactStep checkout={checkout} phone="" onPhone={vi.fn()} onDone={done} />);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Email'), 'bad');
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Email'));
    await userEvent.type(screen.getByLabelText('Email'), 'guest1@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(checkout.saveDetails).toHaveBeenCalledWith({ email: 'guest1@example.com' }));
    expect(done).toHaveBeenCalled();
  });

  it('guest: offers sign in, and says a bundle with monthly items needs an account', () => {
    renderWithProviders(<ContactStep checkout={fakeCheckout(makeState())} phone="" onPhone={vi.fn()} onDone={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Have an account? Sign in' })).toHaveAttribute('href', '/en-US/login?next=%2Fbundle%2Fcheckout');
    expect(screen.getByText(/Your bundle has monthly items/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/en-US/register');
  });

  it('signed in: the email is the account email, read-only, and continuing writes nothing', async () => {
    const checkout = fakeCheckout(makeState({ signedIn: true, email: 'qa-u1@example.com' }));
    const done = vi.fn();
    renderWithProviders(<ContactStep checkout={checkout} phone="" onPhone={vi.fn()} onDone={done} />);
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Email')).toHaveValue('qa-u1@example.com');
    expect(screen.queryByRole('link', { name: 'Have an account? Sign in' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(checkout.saveDetails).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
  });

  it('signed in: the phone starts from the default service address', () => {
    book.defaultService = { phone: '555 010 2000' };
    const onPhone = vi.fn();
    renderWithProviders(<ContactStep checkout={fakeCheckout(makeState({ signedIn: true, email: 'a@b.co' }))} phone="" onPhone={onPhone} onDone={vi.fn()} />);
    expect(onPhone).toHaveBeenCalledWith('555 010 2000');
  });

  it('an invalid phone blocks the step', async () => {
    const checkout = fakeCheckout(makeState({ signedIn: true, email: 'a@b.co' }));
    renderWithProviders(<ContactStep checkout={checkout} phone="abc" onPhone={vi.fn()} onDone={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a valid phone number.')).toBeInTheDocument();
  });

  it('de-DE: German labels', () => {
    renderWithProviders(<ContactStep checkout={fakeCheckout(makeState())} phone="" onPhone={vi.fn()} onDone={vi.fn()} />, { locale: 'de-DE' });
    expect(screen.getByLabelText('E-Mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Mobiltelefon (optional)')).toBeInTheDocument();
  });
});
