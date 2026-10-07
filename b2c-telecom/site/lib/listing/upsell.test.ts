import { LISTED_APPLETV, LISTED_CLOUD, LISTED_NETFLIX, LISTED_SPOTIFY } from './__fixtures__/catalog';
import { upsellNames } from './upsell';

describe('upsellNames', () => {
  it('the featured streaming add-ons come first, whatever the order of the list', () => {
    expect(upsellNames([LISTED_NETFLIX, LISTED_APPLETV, LISTED_SPOTIFY])).toEqual(['Spotify', 'Apple TV+']);
  });

  it('fills up with other streaming add-ons when a featured one is missing', () => {
    expect(upsellNames([LISTED_NETFLIX, LISTED_SPOTIFY])).toEqual(['Spotify', 'Netflix']);
  });

  it('ignores add-ons that are not streaming and gives fewer names when there are fewer', () => {
    const security = { ...LISTED_CLOUD, facts: { ...(LISTED_CLOUD.facts as object), addonKind: 'security' } as typeof LISTED_CLOUD.facts };
    expect(upsellNames([security, LISTED_SPOTIFY])).toEqual(['Spotify']);
    expect(upsellNames([])).toEqual([]);
  });
});
