import { describe, expect, it } from 'vitest';
import { backToList, doctorHref } from './doctor-back';

describe('design-pdp: Back link keeps context (helpers)', () => {
  it('a card link carries the mode and, when the list has filters, the list URL', () => {
    expect(doctorHref('mlv-doc-a', 'remote')).toBe('/doctor/mlv-doc-a?m=remote');
    expect(doctorHref('mlv-doc-a', 'remote', '/doctors/remote')).toBe('/doctor/mlv-doc-a?m=remote');
    expect(doctorHref('mlv-doc-a', 'office', '/doctors/office?specialty=dermatology&page=2')).toBe(
      '/doctor/mlv-doc-a?m=office&back=%2Fdoctors%2Foffice%3Fspecialty%3Ddermatology%26page%3D2',
    );
  });

  it('the list URL survives the round trip through the card link', () => {
    const href = doctorHref('mlv-doc-a', 'office', '/doctors/office?q=skin&today=1');
    const back = new URL(href, 'http://x').searchParams.get('back') ?? undefined;
    expect(backToList(back, 'office')).toBe('/doctors/office?q=skin&today=1');
  });

  it('only list paths qualify; the rest gives the plain list of the mode', () => {
    expect(backToList(undefined, 'remote')).toBe('/doctors/remote');
    expect(backToList('/cart', 'office')).toBe('/doctors/office');
    expect(backToList('/doctors/remote#x', 'office')).toBe('/doctors/office');
    expect(backToList(`/doctors/remote?q=${'a'.repeat(500)}`, 'remote')).toBe('/doctors/remote');
  });
});
