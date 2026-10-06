describe('smoke', () => {
  it('runs unit tests', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a jsdom document', () => {
    expect(document.body).toBeDefined();
  });
});
