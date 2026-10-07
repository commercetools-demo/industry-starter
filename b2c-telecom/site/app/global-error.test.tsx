import { renderToStaticMarkup } from 'react-dom/server';
import GlobalError from './global-error';

describe('global-error', () => {
  it('renders its own html and body with both languages and no data dependencies', () => {
    const markup = renderToStaticMarkup(<GlobalError error={new Error('secret')} reset={() => undefined} />);
    expect(markup).toMatch(/^<html lang="en"/);
    expect(markup).toContain('<body>');
    expect(markup).toContain('Something went wrong · Etwas ist schiefgelaufen');
    expect(markup).toContain('Try again · Erneut versuchen');
    expect(markup).toContain('href="/"');
    expect(markup).not.toContain('secret');
  });
});
