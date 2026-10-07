describe('smoke', () => {
  it('computes', () => {
    expect(1 + 1).toBe(2);
  });
  it('has a jsdom document body', () => {
    expect(document.body).toBeDefined();
  });
});
