import { screen, within } from '@testing-library/react';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import de from '@/messages/de-DE.json';
import en from '@/messages/en-US.json';
import { renderWithProviders } from '@/test/utils';
import { SectionHeading } from './SectionHeading';
import { Table } from './Table';

describe('SectionHeading', () => {
  it('renders the kicker (h6), the heading (h2) and a ghost link', () => {
    renderWithProviders(<SectionHeading kicker="This week" title="Fresh picks" linkLabel="See all" linkHref="/shop" />);
    expect(screen.getByRole('heading', { level: 6, name: 'This week' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Fresh picks' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'See all' });
    expect(link).toHaveAttribute('href', '/en-US/shop');
    expect(link).toHaveClass('btn-ghost');
  });

  it('renders no link without a label and href', () => {
    renderWithProviders(<SectionHeading kicker="k" title="t" />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('Table', () => {
  it('has a captioned table with column headers and body rows', () => {
    render_table();
    const table = screen.getByRole('table', { name: 'Orders' });
    expect(table).toHaveClass('table');
    const headers = within(table).getAllByRole('columnheader');
    expect(headers.map((h) => h.textContent)).toEqual(['Item', 'Status']);
    headers.forEach((h) => expect(h).toHaveAttribute('scope', 'col'));
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByRole('cell', { name: 'Bananas' })).toBeInTheDocument();
  });
});

function render_table() {
  return renderWithProviders(
    <Table caption="Orders" columns={['Item', 'Status']}>
      <tr>
        <td>Bananas</td>
        <td>Packed</td>
      </tr>
    </Table>,
  );
}

describe('AnnouncementBar', () => {
  it('shows common.announcement in en-US', () => {
    renderWithProviders(<AnnouncementBar />);
    expect(screen.getByText(en.common.announcement)).toBeInTheDocument();
  });

  it('shows common.announcement in de-DE', () => {
    renderWithProviders(<AnnouncementBar />, { locale: 'de-DE' });
    expect(screen.getByText(de.common.announcement)).toBeInTheDocument();
  });
});
