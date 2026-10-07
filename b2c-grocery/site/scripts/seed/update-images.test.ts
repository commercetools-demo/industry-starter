import { describe, expect, it } from 'vitest';
import { cleanUrl, jpegSize, parseArgs, pickUrls, searchTerm } from './update-images';

describe('update-images', () => {
  it('cleanUrl drops the query and fragment', () => {
    expect(cleanUrl('https://media.istockphoto.com/id/1/photo/a.jpg?b=1&s=612x612&w=0&k=20&c=x=#f')).toBe('https://media.istockphoto.com/id/1/photo/a.jpg');
  });

  it('searchTerm drops a trailing pack size only', () => {
    expect(searchTerm('Whole milk 1 L')).toBe('Whole milk');
    expect(searchTerm('Sparkling water 6×1 L')).toBe('Sparkling water');
    expect(searchTerm('Paper towels 4 rolls')).toBe('Paper towels');
    expect(searchTerm('Free-range eggs 12')).toBe('Free-range eggs');
    expect(searchTerm('Trash bags 20')).toBe('Trash bags');
    expect(searchTerm('Green tea 20 bags')).toBe('Green tea');
    expect(searchTerm('Greek yogurt 500 g')).toBe('Greek yogurt');
    expect(searchTerm('Cheddar block')).toBe('Cheddar block');
  });

  it('pickUrls takes the first distinct clean URLs and skips items without an image', () => {
    const item = (image?: string) => ({ attributes: { image } });
    const response = { data: [item(), item('https://h/a.jpg?s=1'), item('https://h/a.jpg?s=2'), item('https://h/b.jpg?s=1'), item('https://h/c.jpg')] };
    expect(pickUrls(response, 2)).toEqual(['https://h/a.jpg', 'https://h/b.jpg']);
    expect(pickUrls({}, 2)).toEqual([]);
    expect(pickUrls(null, 2)).toEqual([]);
  });

  it('jpegSize reads the start-of-frame marker', () => {
    // SOI, APP0 (len 16), SOF0 (len 17): height 408, width 612
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...new Array(14).fill(0), 0xff, 0xc0, 0, 17, 8, 0x01, 0x98, 0x02, 0x64, 3, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(jpegSize(bytes)).toEqual({ w: 612, h: 408 });
    expect(jpegSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('parseArgs', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, only: undefined, count: 2 });
    expect(parseArgs(['--dry-run', '--only', 'bananas', '--count', '3'])).toEqual({ dryRun: true, only: 'bananas', count: 3 });
    expect(() => parseArgs(['--count', '0'])).toThrow();
  });
});
