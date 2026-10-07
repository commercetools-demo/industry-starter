import { render } from '@testing-library/react';
import { OfferAnchor } from './OfferAnchor';

describe('OfferAnchor', () => {
  it('Linking to one offer: card is scrolled to and marked', () => {
    // jsdom has no layout and no scrollIntoView: the stub records which element was scrolled to.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(
      <>
        <div id="offer-malva-offer-cable-gig" data-highlighted="true" />
        <OfferAnchor offerKey="malva-offer-cable-gig" />
      </>,
    );
    expect(document.getElementById('offer-malva-offer-cable-gig')).toHaveAttribute('data-highlighted', 'true');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('offer-malva-offer-cable-gig'));
  });

  it('an unknown offer id is a no-op', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    expect(() => render(<OfferAnchor offerKey="malva-offer-missing" />)).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
