import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPLATES } from './defaults';
import { renderTemplate, renderText, SAMPLE_VARIABLES } from './render';

describe('preview uses sample data and escapes', () => {
  it('fills the sample order number', () => {
    expect(renderText(DEFAULT_TEMPLATES['order-confirmation'].subject['en-US'], SAMPLE_VARIABLES)).toBe('Your order MO-482913 is confirmed');
  });
  it('escapes a script in a value and in the text', () => {
    const html = renderTemplate('Hi {{customer_name}} <b>x</b>', { customer_name: '<script>alert(1)</script>' });
    expect(html).toBe('Hi &lt;script&gt;alert(1)&lt;/script&gt; &lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<script>');
  });
  it('turns newlines into line breaks', () => {
    expect(renderTemplate('a\r\nb\nc', {})).toBe('a<br>b<br>c');
  });
});
