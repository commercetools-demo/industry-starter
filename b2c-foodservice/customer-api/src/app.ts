import { randomUUID } from 'node:crypto';
import cors from 'cors';
import type { Customer } from '@commercetools/platform-sdk';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { HttpError } from './errors';
import type { CartState, CtApi, Paging } from './ct-api';
import {
  addNote,
  deleteNote,
  editNote,
  parseExpected,
  parseIndex,
  parseText,
  presentNotes,
  storedNotes,
  writeNotes,
} from './notes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CART_STATES: readonly CartState[] = ['Active', 'Merged', 'Ordered', 'Frozen'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface AppOptions {
  corsOrigin?: string;
  /** Receives one JSON log line per request. Defaults to stdout. */
  log?: (line: Record<string, unknown>) => void;
}

const wrap =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

function wholeNumber(raw: unknown, name: string, fallback: number, max?: number): number {
  if (raw === undefined) return fallback;
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new HttpError(400, `invalid_${name}`, `${name} must be a whole number`);
  const n = Number(raw);
  if (max !== undefined && n > max) return max;
  return n;
}

function paging(req: Request): Paging {
  return {
    limit: Math.max(1, wholeNumber(req.query.limit, 'limit', DEFAULT_LIMIT, MAX_LIMIT)),
    offset: wholeNumber(req.query.offset, 'offset', 0),
  };
}

export function createApp(api: CtApi, options: AppOptions = {}): express.Express {
  const log = options.log ?? ((line) => console.log(JSON.stringify(line)));
  const app = express();
  app.disable('x-powered-by');

  app.use(
    cors({
      origin: options.corsOrigin ?? '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type'],
      credentials: false,
      maxAge: 600,
    }),
  );

  // Correlation id and one log line per request (route pattern only, never bodies or note texts).
  app.use((req, res, next) => {
    const started = Date.now();
    const correlationId = (req.header('X-Correlation-ID') ?? '').slice(0, 100) || randomUUID();
    res.setHeader('X-Correlation-ID', correlationId);
    res.on('finish', () => {
      log({ method: req.method, route: req.route?.path ?? 'unmatched', status: res.statusCode, ms: Date.now() - started, correlationId });
    });
    next();
  });

  app.use(express.json({ limit: '16kb' }));

  const router = express.Router();
  const notAllowed = (allow: string): RequestHandler => (_req, res) => {
    res.setHeader('Allow', allow);
    res.status(405).json({ error: 'method_not_allowed', message: `allowed: ${allow}` });
  };

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Every customer route: a UUID, and a customer that exists.
  router.param('customerId', (_req, res, next, value: string) => {
    if (!UUID.test(value)) return next(new HttpError(400, 'invalid_customer_id', 'customerId must be a UUID'));
    api
      .getCustomer(value)
      .then((customer) => {
        if (!customer) throw new HttpError(404, 'customer_not_found', 'customer not found');
        res.locals.customer = customer;
        next();
      })
      .catch(next);
  });

  // --- orders, carts, wishlists ---
  router
    .route('/:customerId/orders')
    .get(wrap(async (req, res) => void res.json(await api.listOrders(req.params.customerId, paging(req)))))
    .all(notAllowed('GET'));

  router
    .route('/:customerId/orders/:id')
    .get(
      wrap(async (req, res) => {
        const order = await api.getOrder(req.params.id);
        if (!order || order.customerId !== req.params.customerId) throw new HttpError(404, 'not_found', 'order not found');
        res.json(order);
      }),
    )
    .all(notAllowed('GET'));

  router
    .route('/:customerId/carts')
    .get(
      wrap(async (req, res) => {
        const state = req.query.cartState;
        if (state !== undefined && !CART_STATES.includes(state as CartState)) {
          throw new HttpError(400, 'invalid_cartState', `cartState must be one of ${CART_STATES.join(', ')}`);
        }
        res.json(await api.listCarts(req.params.customerId, paging(req), state as CartState | undefined));
      }),
    )
    .all(notAllowed('GET'));

  router
    .route('/:customerId/carts/:id')
    .get(
      wrap(async (req, res) => {
        const cart = await api.getCart(req.params.id);
        if (!cart || cart.customerId !== req.params.customerId) throw new HttpError(404, 'not_found', 'cart not found');
        res.json(cart);
      }),
    )
    .all(notAllowed('GET'));

  router
    .route('/:customerId/wishlists')
    .get(wrap(async (req, res) => void res.json(await api.listShoppingLists(req.params.customerId, paging(req)))))
    .all(notAllowed('GET'));

  router
    .route('/:customerId/wishlists/:id')
    .get(
      wrap(async (req, res) => {
        const list = await api.getShoppingList(req.params.id);
        if (!list || list.customer?.id !== req.params.customerId) throw new HttpError(404, 'not_found', 'wishlist not found');
        res.json(list);
      }),
    )
    .all(notAllowed('GET'));

  // --- notes ---
  router
    .route('/:customerId/notes')
    .get((_req, res) => {
      res.json({ notes: presentNotes(storedNotes(res.locals.customer as Customer)) });
    })
    .post(
      wrap(async (req, res) => {
        const text = parseText(req.body?.text);
        const notes = await writeNotes(api, req.params.customerId, addNote(text));
        res.status(201).json({ notes });
      }),
    )
    .all(notAllowed('GET, POST'));

  router
    .route('/:customerId/notes/:index')
    .put(
      wrap(async (req, res) => {
        const index = parseIndex(req.params.index);
        const text = parseText(req.body?.text);
        const expected = parseExpected(req.body?.expected);
        res.json({ notes: await writeNotes(api, req.params.customerId, editNote(index, text, expected)) });
      }),
    )
    .delete(
      wrap(async (req, res) => {
        const index = parseIndex(req.params.index);
        // Some clients drop DELETE bodies, so `expected` is also accepted as a query parameter.
        const expected = parseExpected(req.body?.expected ?? req.query.expected);
        res.json({ notes: await writeNotes(api, req.params.customerId, deleteNote(index, expected)) });
      }),
    )
    .all(notAllowed('PUT, DELETE'));

  // --- loyalty points: read only ---
  router
    .route('/:customerId/loyaltyPoints')
    .get((_req, res) => {
      const customer = res.locals.customer as Customer;
      const value = customer.custom?.fields.loyaltyPoints as unknown;
      res.json({ customerId: customer.id, loyaltyPoints: typeof value === 'number' ? value : 0 });
    })
    .all(notAllowed('GET'));

  app.use('/customers', router);

  app.use((_req, _res, next) => next(new HttpError(404, 'not_found', 'no such route')));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.code, message: err.message });
    if ((err as { type?: string }).type === 'entity.parse.failed') {
      return void res.status(400).json({ error: 'invalid_json', message: 'request body is not valid JSON' });
    }
    if ((err as { type?: string }).type === 'entity.too.large') {
      return void res.status(413).json({ error: 'body_too_large', message: 'request body is too large' });
    }
    const dev = process.env.NODE_ENV === 'development';
    log({ error: 'unhandled', message: err instanceof Error ? err.message : String(err) });
    res.status(502).json({ error: 'upstream_error', message: dev && err instanceof Error ? err.message : 'commercetools request failed' });
  });

  return app;
}
