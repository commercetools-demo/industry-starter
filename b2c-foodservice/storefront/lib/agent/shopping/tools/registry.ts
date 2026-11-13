// Copyright 2026 Anthropic PBC
// SPDX-License-Identifier: Apache-2.0
// Adapted from shopping-agent/core/shopping_agent/tools/registry.py; changes: TypeScript port; descriptions and schemas transcribed verbatim (checked against the upstream source by registry.test.ts when UPSTREAM_DIR is set); inline-context descriptions for the SDK and MCP paths not ported; presentation extensions take a minimal interface.

import { LOAD_SKILL, type ToolDefinition, withStatus } from '../../common/execution';
import { type ShoppingAgentConfig, absentTools } from '../config';

/** The tool contracts in a fixed order. The list depends only on the deployment config, so it is the same bytes on every request; whether a capability can serve a call is decided in the executor. A description covers one tool; rules that span tools live in the prompt or a skill. Descriptions are copied, never reworded: each clause does a job the safety table depends on. */

const SESSION_PRODUCT_ID = 'product_id returned by a tool this session.';
const STATUS_READER = 'the customer';

function productId(role: string = SESSION_PRODUCT_ID): Record<string, unknown> {
  return { type: 'string', description: role };
}

function filtersSchema(): Record<string, unknown> {
  return {
    type: 'object',
    description: 'Constraints the customer stated; leave guesses in the query.',
    properties: {
      category: { type: 'string', description: 'Catalog category name.' },
      min_price: { type: 'number', description: 'Lowest acceptable price.' },
      max_price: { type: 'number', description: 'Price ceiling the customer stated.' },
      min_rating: { type: 'number', description: 'Lowest acceptable average rating.' },
      attributes: {
        type: 'object',
        description: 'Attribute or option filters as key/value pairs, e.g. {"material": "wool"}.',
        additionalProperties: { type: 'string' },
      },
      sort: {
        type: 'string',
        enum: ['relevance', 'price_asc', 'price_desc', 'rating'],
        description: 'Result order; relevance unless the customer asked otherwise.',
      },
    },
    additionalProperties: false,
  };
}

function title(what: string): Record<string, unknown> {
  return { type: 'string', maxLength: 80, description: `Short heading for the ${what}.` };
}

/** A presentation extension a deployment appends AFTER the built-ins (append, never interleave: the array order is prompt bytes and the byte pin on the upstream render is what lets a reviewer tell an accidental edit from an intended one). */
export interface PresentationExtensionLike {
  readonly name: string;
  toolDefinition(): ToolDefinition;
}

/**
 * The tool list for one deployment: built-ins in a fixed order, less the systems the config switches off, then the deployment's
 * presentation extensions in the order given, then web search when enabled. Every tool but the presentation tools and web search takes
 * the optional `status` line first. The memory tools stay registered whatever `enableMemory` says (they change behaviour, not bytes).
 */
export function buildTools(config: ShoppingAgentConfig, skillNames: readonly string[], extraPresentationTools: readonly PresentationExtensionLike[] = []): ToolDefinition[] {
  const tools: ToolDefinition[] = [
    {
      name: LOAD_SKILL,
      description:
        'Load the rules of the flow whose entry in the skill index the request matches; they are not in your prompt. Call it in the same round as the flow\'s first read and follow them for the rest of the flow.',
      input_schema: {
        type: 'object',
        properties: {
          skill_name: {
            type: 'string',
            enum: [...skillNames].sort(),
            description: 'Name of the skill as listed in the index.',
          },
        },
        required: ['skill_name'],
        additionalProperties: false,
      },
    },
    {
      name: 'search_products',
      description:
        'Search the catalog; returns products with id, title, brand, price, rating, and availability; a product with options shows its lowest in-stock price and its options. Use a specific query and put stated constraints in filters. Run one search per distinct item a request names.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: "What to look for, in the catalog's vocabulary." },
          filters: filtersSchema(),
          limit: { type: 'integer', minimum: 1, maximum: config.maxSearchResults, description: 'Maximum results to return.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'get_product_details',
      description:
        'Full details for one product: description, specs, review highlights, and for a product with options, its variants with their ids, prices, and stock. Use for a question about one product, before comparing finalists or choosing a variant, and for a reference shaped like a catalog id.',
      input_schema: {
        type: 'object',
        properties: { product_id: productId('Catalog product_id to look up.') },
        required: ['product_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'get_cart',
      description: 'Current cart contents with quantities and subtotal.',
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'add_to_cart',
      description:
        'Add a product, or the chosen variant of a product with options, by a product_id a catalog or order tool returned this session; quantity defaults to 1. If the result says the item is unavailable, say so and offer an alternative; add that only once the customer chooses it.',
      input_schema: {
        type: 'object',
        properties: {
          product_id: productId(),
          quantity: { type: 'integer', minimum: 1, description: 'Units to add; omit for one.' },
        },
        required: ['product_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'update_cart_item',
      description: 'Set the quantity of an item that is already in the cart.',
      input_schema: {
        type: 'object',
        properties: {
          product_id: productId('product_id of a line already in the cart.'),
          quantity: { type: 'integer', minimum: 1, description: 'New quantity for the line.' },
        },
        required: ['product_id', 'quantity'],
        additionalProperties: false,
      },
    },
    {
      name: 'remove_from_cart',
      description: 'Remove an item from the cart.',
      input_schema: {
        type: 'object',
        properties: { product_id: productId('product_id of the line to remove.') },
        required: ['product_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'get_preferences',
      description: "The customer's profile and saved preferences. Usually already in the Session context block; call this only when it is missing there.",
      input_schema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'get_orders',
      description: 'Recent orders with status and estimated delivery. Use for a status question that names no order and for a request to buy something again.',
      input_schema: {
        type: 'object',
        properties: { limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximum orders to return.' } },
        additionalProperties: false,
      },
    },
    {
      name: 'get_order_status',
      description: 'Status, items, and tracking for one order the customer named.',
      input_schema: {
        type: 'object',
        properties: { order_id: { type: 'string', description: 'Order id to look up.' } },
        required: ['order_id'],
        additionalProperties: false,
      },
    },
    {
      name: 'search_policies',
      description: "Search the store's own terms and help content: returns, shipping, warranties, membership, fees, and the buying guides.",
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'The term or topic to look up.' } },
        required: ['query'],
        additionalProperties: false,
      },
    },
    {
      name: 'get_fulfillment_options',
      description: "Delivery and pickup options, with their dates, for given products at the customer's location.",
      input_schema: {
        type: 'object',
        properties: {
          product_ids: { type: 'array', items: { type: 'string' }, maxItems: 20, description: 'product_ids to quote options for.' },
        },
        required: ['product_ids'],
        additionalProperties: false,
      },
    },
    {
      name: 'save_memory',
      description:
        'Save a durable fact about the customer when they ask you to remember something or state a standing rule about how they shop. An ask to remember is the memory-personalization flow, and its skill says how the fact is worded: read it in the same round. Save the need an item reveals, never product or policy text.',
      input_schema: {
        type: 'object',
        properties: {
          key: { type: 'string', maxLength: 64, description: 'Topic key; reuse an existing key to replace its value.' },
          value: { type: 'string', maxLength: 200, description: 'The fact, worded to stand on its own later.' },
          category: {
            type: 'string',
            enum: ['preference', 'constraint', 'context'],
            description: 'constraint for a rule picks must respect; else preference or context.',
          },
        },
        required: ['key', 'value'],
        additionalProperties: false,
      },
    },
    {
      name: 'recall_memories',
      description:
        'Search the customer\'s saved facts that are not in the Session context block: older preferences, sizes, past recipients, recurring needs. Use it when such a fact would change your recommendation.',
      input_schema: {
        type: 'object',
        properties: { topic: { type: 'string', maxLength: 100, description: 'Topic to search for, in a few words.' } },
        required: ['topic'],
        additionalProperties: false,
      },
    },
  ];

  const presentation: ToolDefinition[] = [
    {
      name: 'present_products',
      description:
        "Show products from this session's results as cards; the UI fills in title, price, and image. Layout: carousel by default, grid to scan many options, list when order matters. Each pick's reason is the one judgment of yours on the card.",
      input_schema: {
        type: 'object',
        properties: {
          title: title('set of cards'),
          layout: { type: 'string', enum: ['carousel', 'grid', 'list'], description: 'Card layout; carousel when omitted.' },
          picks: {
            type: 'array',
            minItems: 1,
            maxItems: 12,
            description: 'Products to show, recommended pick first.',
            items: {
              type: 'object',
              properties: {
                product_id: productId(),
                reason: { type: 'string', maxLength: 140, description: 'One clause tying the pick to a stated need.' },
              },
              required: ['product_id'],
              additionalProperties: false,
            },
          },
        },
        required: ['picks'],
        additionalProperties: false,
      },
    },
    {
      name: 'present_comparison',
      description:
        "Compare 2-4 finalists side by side, with pros, cons, and what each is best for. Use it once the customer has narrowed to them or asks how they differ; a fresh shortlist goes through present_products. The UI adds the price delta; your text says what the extra money buys.",
      input_schema: {
        type: 'object',
        properties: {
          title: title('comparison'),
          entries: {
            type: 'array',
            minItems: 2,
            maxItems: 4,
            description: 'The finalists being compared.',
            items: {
              type: 'object',
              properties: {
                product_id: productId(),
                pros: { type: 'array', items: { type: 'string' }, maxItems: 4, description: 'Short advantages, from tool results.' },
                cons: { type: 'array', items: { type: 'string' }, maxItems: 3, description: 'Short drawbacks, from tool results.' },
                best_for: { type: 'string', maxLength: 80, description: 'Who or what this option suits best.' },
              },
              required: ['product_id'],
              additionalProperties: false,
            },
          },
          dimensions: { type: 'array', items: { type: 'string' }, maxItems: 6, description: 'The dimensions the customer is weighing.' },
          recommended_product_id: productId('The entry you recommend.'),
        },
        required: ['entries'],
        additionalProperties: false,
      },
    },
    {
      name: 'present_plan',
      description:
        "Show a plan toward the customer's goal as steps with products attached. When no step will ever carry a product, the answer is know-how; use present_guide.",
      input_schema: {
        type: 'object',
        properties: {
          title: title('plan'),
          intro: { type: 'string', maxLength: 240, description: 'One or two lines of framing, assumptions included.' },
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 12,
            description: "The plan's steps, in working order.",
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', maxLength: 120, description: "Step name in the customer's words." },
                detail: { type: 'string', maxLength: 240, description: 'One line on what the step covers.' },
                product_ids: { type: 'array', items: { type: 'string' }, maxItems: 8, description: 'Items for this step, your pick first.' },
              },
              required: ['label'],
              additionalProperties: false,
            },
          },
        },
        required: ['title', 'steps'],
        additionalProperties: false,
      },
    },
    {
      name: 'present_guide',
      description:
        'Show a how-to, an idea, or an itinerary as a card of short sections. Use for guidance that is not a product plan; list sources when web content informed it.',
      input_schema: {
        type: 'object',
        properties: {
          title: title('guide'),
          sections: {
            type: 'array',
            minItems: 1,
            maxItems: 8,
            description: 'Sections of one to three sentences each.',
            items: {
              type: 'object',
              properties: {
                heading: { type: 'string', maxLength: 80, description: 'Section heading.' },
                body: { type: 'string', maxLength: 600, description: 'Section text.' },
              },
              required: ['heading', 'body'],
              additionalProperties: false,
            },
          },
          related_product_ids: { type: 'array', items: { type: 'string' }, maxItems: 8, description: 'Products from this session the guide relates to.' },
          sources: { type: 'array', items: { type: 'string' }, maxItems: 5, description: 'Guides or pages the sections were drawn from.' },
        },
        required: ['title', 'sections'],
        additionalProperties: false,
      },
    },
    {
      name: 'present_order_status',
      description:
        'Show the status card for one order; the UI fills in the order data. Every answer about where an order stands goes through it. When several orders are in flight, send one card per order in the same round.',
      input_schema: {
        type: 'object',
        properties: {
          order_id: { type: 'string', description: 'Order id from get_orders or get_order_status.' },
          summary: { type: 'string', maxLength: 300, description: 'Current state and expected date, in a sentence.' },
          next_step: { type: 'string', maxLength: 200, description: 'The one concrete thing the customer can do next.' },
        },
        required: ['order_id', 'summary'],
        additionalProperties: false,
      },
    },
    {
      name: 'checkout',
      description:
        'Stage the current cart as an order summary the customer confirms in the app; it places no order and charges nothing. Use only when the customer asks to check out.',
      input_schema: {
        type: 'object',
        properties: {
          note: { type: 'string', maxLength: 300, description: 'Anything the customer should check before confirming.' },
          fulfillment_method: {
            type: 'string',
            enum: ['delivery', 'pickup', 'shipping'],
            description: 'Method the customer chose, when they chose one.',
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'present_suggestions',
      description:
        "Give the turn its 1-4 chips; it ends the reply. Call it in the same round as the turn's last component, without waiting for that component's result. Alone, after the text, only on a turn with no component (a terms answer, a clarifying question, a confirmed add or save).",
      input_schema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 4,
            description: '1-4 chips, each a brief imperative and each a different kind of step; leave out anything this turn already displayed.',
          },
        },
        required: ['suggestions'],
        additionalProperties: false,
      },
    },
  ];

  const absent = absentTools(config);
  const list: ToolDefinition[] = tools.filter((t) => !absent.has(t.name)).map((t) => withStatus(t, STATUS_READER));
  list.push(...presentation.filter((t) => !absent.has(t.name)));

  if (config.enableDisclosures) {
    list.push({
      name: 'present_disclosure',
      description:
        "Show the standardized disclosure box for one product: its terms, fees, and typical performance as the store's systems state them. Use when an answer states fees or regulated terms for a product, the customer's current plan included.",
      input_schema: {
        type: 'object',
        properties: { product_id: productId('The product the terms attach to.'), title: title('disclosure box') },
        required: ['product_id'],
        additionalProperties: false,
      },
    });
  }

  const names = new Set(list.map((t) => t.name));
  for (const extension of extraPresentationTools) {
    if (names.has(extension.name)) throw new Error(`presentation extension '${extension.name}' collides with a built-in tool`);
    names.add(extension.name);
    list.push(extension.toolDefinition());
  }

  if (config.enableWebSearch) {
    // Pinned; newer web_search versions exist, so re-run evals before moving.
    list.push({ type: 'web_search_20250305', name: 'web_search', max_uses: 3 });
  }

  return list;
}
