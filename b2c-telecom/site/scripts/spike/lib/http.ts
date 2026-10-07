// Raw HTTP client of the checkout spike. The recurring payment fields are not in the SDK types yet (beta), so the spike
// talks plain JSON. Token and credentials stay inside this module and are never logged.
export type Rec = Record<string, unknown>;

export class SpikeHttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message.slice(0, 200));
    this.name = 'SpikeHttpError';
  }
}

export interface SpikeEnv {
  projectKey: string;
  apiUrl: string;
  authUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  checkoutAppKey?: string;
}

export const ALLOWED_PROJECT = 'spec-test-b2c-telecom';

export function readSpikeEnv(source: Record<string, string | undefined>): SpikeEnv {
  const need = (name: string): string => {
    const value = source[name];
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
  };
  const env: SpikeEnv = {
    projectKey: need('CTP_PROJECT_KEY'),
    apiUrl: need('CTP_API_URL'),
    authUrl: need('CTP_AUTH_URL'),
    clientId: need('CTP_CLIENT_ID'),
    clientSecret: need('CTP_CLIENT_SECRET'),
    scopes: source.CTP_SCOPES ?? '',
    ...(source.CTP_CHECKOUT_APP_KEY ? { checkoutAppKey: source.CTP_CHECKOUT_APP_KEY } : {}),
  };
  if (env.projectKey !== ALLOWED_PROJECT) throw new Error(`Refusing to run: project "${env.projectKey}" is not ${ALLOWED_PROJECT} (D-054)`);
  return env;
}

export interface Http {
  /** Path relative to the project, e.g. `carts/<id>`. */
  api(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<Rec>;
  /** Same project, other service host (`session` or `checkout`), full path after the project key. */
  service(host: 'session' | 'checkout', method: 'GET' | 'POST', path: string, body?: unknown): Promise<{ status: number; body: Rec }>;
}

export function createHttp(env: SpikeEnv, fetchImpl: typeof fetch = fetch): Http {
  let token: Promise<string> | undefined;
  const getToken = (): Promise<string> => {
    token ??= (async () => {
      const res = await fetchImpl(`${env.authUrl}/oauth/token`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${env.clientId}:${env.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials${env.scopes ? `&scope=${encodeURIComponent(env.scopes)}` : ''}`,
      });
      const json = (await res.json()) as { access_token?: string };
      if (!res.ok || !json.access_token) throw new SpikeHttpError(res.status, 'auth', 'token request failed');
      return json.access_token;
    })();
    return token;
  };

  async function send(url: string, method: string, body?: unknown): Promise<{ status: number; body: Rec }> {
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${await getToken()}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let parsed: Rec = {};
    try {
      parsed = text ? (JSON.parse(text) as Rec) : {};
    } catch {
      parsed = { message: text.slice(0, 200) };
    }
    if (!res.ok) {
      const first = (parsed.errors as { code?: string; message?: string }[] | undefined)?.[0];
      throw new SpikeHttpError(res.status, first?.code, first?.message ?? (typeof parsed.message === 'string' ? parsed.message : `HTTP ${res.status}`));
    }
    return { status: res.status, body: parsed };
  }

  return {
    api: async (method, path, body) => (await send(`${env.apiUrl}/${env.projectKey}/${path}`, method, body)).body,
    service: (host, method, path, body) => send(`${env.apiUrl.replace('//api.', `//${host}.`)}/${env.projectKey}/${path}`, method, body),
  };
}
