import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useToast } from '@/components/ui/Toast';
import { renderWithProviders } from './utils';

function Probe() {
  const { show } = useToast();
  return <button onClick={() => show({ message: 'Hello toast' })}>go</button>;
}

describe('renderWithProviders', () => {
  it('includes the ToastProvider', async () => {
    renderWithProviders(<Probe />);
    await userEvent.click(screen.getByText('go'));
    expect(screen.getByRole('status')).toHaveTextContent('Hello toast');
  });
});
