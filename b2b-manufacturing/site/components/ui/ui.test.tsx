import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import messages from '@/messages/en-US.json';
import { Button, LinkButton } from './Button';
import { AudienceCard, CertChip, CertRow, CheckList, CtaBand, OptionCard, PageHeader, SampleMarker, ServiceCard, Stat, Stepper, Tag, Testimonial } from './content';
import { Field } from './Field';
import { LiveRegion } from './LiveRegion';

vi.mock('next/navigation', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/navigation')>()), usePathname: () => '/en-US', useRouter: () => ({ push: vi.fn() }) }));
const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="en-US" messages={messages}>{ui}</NextIntlClientProvider>);

describe('shared components', () => {
  it('Button variants and LinkButton keep the locale prefix', () => {
    wrap(<><Button variant="outline" small>One</Button><LinkButton href="/about" variant="white">Two</LinkButton></>);
    expect(screen.getByRole('button', { name: 'One' })).toHaveClass('btn', 'o', 'sm');
    expect(screen.getByRole('link', { name: 'Two' })).toHaveAttribute('href', '/en-US/about');
  });
  it('Field wires label, hint and error (aria-describedby, aria-invalid, role alert)', () => {
    wrap(<Field label="Email" hint="Work address" error="Enter a valid email" required />);
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby')!.split(' ');
    expect(describedBy).toHaveLength(2);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
    expect(document.getElementById(describedBy[0]!)).toHaveTextContent('Work address');
  });
  it('Field without an error is not invalid', () => {
    wrap(<Field label="Name" />);
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });
  it('ServiceCard links to the detail page with index, name and summary', () => {
    wrap(<ServiceCard href="/plumbing/x" index={3} name="Drains" summary="Jetting" more="Learn more →" />);
    const card = screen.getByRole('link', { name: /Drains/ });
    expect(card).toHaveAttribute('href', '/en-US/plumbing/x');
    expect(card).toHaveTextContent('03');
  });
  it('Stepper marks the current step and OptionCard reports changes', async () => {
    const change = vi.fn();
    wrap(<><Stepper steps={['Service', 'Site', 'Contact']} current={1} label="Progress" /><OptionCard name="s" value="a" checked={false} onChange={change} title="Plumbing" body="Pipes" /></>);
    expect(screen.getByText('Site').closest('li')).toHaveAttribute('aria-current', 'step');
    await userEvent.click(screen.getByLabelText(/Plumbing/));
    expect(change).toHaveBeenCalledWith('a', true);
  });
  it('LiveRegion announces politely or assertively', () => {
    wrap(<><LiveRegion>Saved</LiveRegion><LiveRegion assertive>Failed</LiveRegion></>);
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });
  it('has no axe violations across the content components', async () => {
    const { container } = wrap(
      <main>
        <PageHeader breadcrumb={{ homeLabel: 'Home', current: 'Plumbing' }} title="Plumbing services" lead="Lead" />
        <Tag>Tag</Tag><SampleMarker label="Sample content" /><CheckList items={['One', 'Two']} /><Stat value="4 h" caption="Response" />
        <CertRow><CertChip title="ISO 9001" caption="Quality" /></CertRow>
        <h2>Section</h2><Testimonial quote="Great" role="Head of Facilities" org="Manufacturer" /><AudienceCard title="Manufacturers" body="Body" />
        <CtaBand title="Ready?" cta="Request a quote" href="/request-a-quote" />
      </main>,
    );
    expect(await axe(container, { rules: { region: { enabled: false } } })).toHaveNoViolations();
  });
});
