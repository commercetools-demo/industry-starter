/** The value of `p`, or null when it fails or takes longer than `ms`. A partial failure is data, not an error. */
export async function withBudget<T>(p: Promise<T>, ms = 2000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([p.catch(() => null), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
