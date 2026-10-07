import { optionalString, parseFrontMatter, requireString, stringList } from './frontmatter';
import { ContentError } from './types';

describe('parseFrontMatter', () => {
  it('reads strings, quoted strings and lists, and returns the body', () => {
    const { data, body } = parseFrontMatter(
      ['---', 'title: Plain title', 'description: "Quoted: with colon"', "kicker: 'Single'", 'tags: [internet, "labels", pricing]', 'extra: ignored', '---', '## Body', 'text'].join('\n'),
    );
    expect(data.title).toBe('Plain title');
    expect(data.description).toBe('Quoted: with colon');
    expect(data.kicker).toBe('Single');
    expect(data.tags).toEqual(['internet', 'labels', 'pricing']);
    expect(body).toBe('## Body\ntext');
  });

  it('a file without front matter has empty data and keeps the whole text', () => {
    expect(parseFrontMatter('# Just text')).toEqual({ data: {}, body: '# Just text' });
  });

  it('throws when the closing delimiter is missing', () => {
    expect(() => parseFrontMatter('---\ntitle: x\nbody')).toThrow(ContentError);
  });

  it('handles CRLF line endings and an empty list', () => {
    const { data, body } = parseFrontMatter('---\r\ntitle: A\r\ntags: []\r\n---\r\nBody');
    expect(data).toEqual({ title: 'A', tags: [] });
    expect(body).toBe('Body');
  });

  it('requireString throws "<file>: missing <key>" and the helpers read typed values', () => {
    const { data } = parseFrontMatter('---\ntitle: T\ntags: [a]\n---\n');
    expect(requireString(data, 'title', 'f.md')).toBe('T');
    expect(() => requireString(data, 'description', 'f.md')).toThrow('f.md: missing description');
    expect(optionalString(data, 'kicker')).toBeUndefined();
    expect(stringList(data, 'tags')).toEqual(['a']);
    expect(stringList(data, 'none')).toEqual([]);
  });
});
