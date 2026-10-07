describe('offline guard', () => {
  it('rejects fetch with a clear message', async () => {
    await expect(async () => fetch('https://example.com')).rejects.toThrow('Network is disabled in unit tests');
  });
});
