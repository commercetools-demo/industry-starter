describe('Offline tests', () => {
  it('an unstubbed fetch fails at once instead of reaching the network', async () => {
    await expect(fetch('https://api.example.com/x')).rejects.toThrow(/Network is disabled in unit tests/);
  });

  it('a test can still stub fetch itself', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')));
    expect(await (await fetch('https://api.example.com/x')).text()).toBe('ok');
    vi.unstubAllGlobals();
    await expect(fetch('https://api.example.com/x')).rejects.toThrow(/Network is disabled/);
  });
});
