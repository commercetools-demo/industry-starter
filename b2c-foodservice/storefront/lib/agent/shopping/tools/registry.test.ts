// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATUS_FIELD, type ToolDefinition } from '../../common/execution';
import { SHOPPING_CONFIG } from '../../deployment';
import { defineShoppingConfig } from '../config';
import { buildTools } from './registry';

const SKILLS = ['customer-care', 'planning-goals', 'purchase-research', 'search-discovery'];
const PRESENTATION = ['present_products', 'present_comparison', 'present_plan', 'present_guide', 'present_order_status', 'checkout', 'present_suggestions', 'present_disclosure'];
const everything = defineShoppingConfig('claude-sonnet-5-5', { enableDisclosures: true });

const names = (tools: ToolDefinition[]): string[] => tools.map((t) => t.name);
const schemaOf = (t: ToolDefinition): { properties: Record<string, Record<string, unknown>> } => t.input_schema as never;

describe('tool registry', () => {
  it('Tool list matches the deployment config, in upstream order', () => {
    expect(names(buildTools(SHOPPING_CONFIG, SKILLS))).toEqual([
      'load_skill', 'search_products', 'get_product_details', 'get_cart', 'add_to_cart', 'update_cart_item', 'remove_from_cart',
      'get_preferences', 'get_orders', 'get_order_status', 'save_memory', 'recall_memories',
      'present_products', 'present_comparison', 'present_plan', 'present_guide', 'present_order_status', 'checkout', 'present_suggestions',
    ]);
  });

  it('Tool list excludes tools of switched-off systems', () => {
    const list = names(buildTools(SHOPPING_CONFIG, SKILLS));
    for (const gone of ['search_policies', 'get_fulfillment_options', 'present_disclosure', 'web_search']) expect(list).not.toContain(gone);
    const noCart = names(buildTools(defineShoppingConfig('m', { enableCart: false, enableOrders: false }), SKILLS));
    for (const gone of ['get_cart', 'add_to_cart', 'update_cart_item', 'remove_from_cart', 'checkout', 'get_orders', 'get_order_status', 'present_order_status']) expect(noCart).not.toContain(gone);
  });

  it('With everything on there are twenty-two tools', () => {
    expect(buildTools(everything, SKILLS)).toHaveLength(22);
    expect(names(buildTools(defineShoppingConfig('m', { enableDisclosures: true, enableWebSearch: true }), SKILLS)).at(-1)).toBe('web_search');
  });

  it('Memory tools stay registered when memory is off (behaviour changes, bytes do not)', () => {
    const list = names(buildTools(SHOPPING_CONFIG, SKILLS));
    expect(list).toContain('save_memory');
    expect(list).toContain('recall_memories');
  });

  it('Prompt and tools are byte identical on two builds', () => {
    expect(JSON.stringify(buildTools(SHOPPING_CONFIG, SKILLS))).toBe(JSON.stringify(buildTools(SHOPPING_CONFIG, [...SKILLS].reverse())));
  });

  it('Changing a non-prompt setting changes nothing', () => {
    const base = JSON.stringify(buildTools(SHOPPING_CONFIG, SKILLS));
    const changed = defineShoppingConfig('another-model', { ...SHOPPING_CONFIG, maxToolIterations: 2, requestTimeoutS: 5, turnDeadlineS: 10, provenanceCap: 5, model: 'another-model', maxQuantityPerItem: 3 });
    expect(JSON.stringify(buildTools(changed, SKILLS))).toBe(base);
  });

  it('Status is the first key of every non-presentation tool and absent on presentation tools', () => {
    for (const tool of buildTools(everything, SKILLS)) {
      const keys = Object.keys(schemaOf(tool).properties);
      if (PRESENTATION.includes(tool.name)) expect(keys).not.toContain(STATUS_FIELD);
      else expect(keys[0]).toBe(STATUS_FIELD);
    }
  });

  it('The search limit ceiling follows the config and the skill enum is sorted', () => {
    const tools = buildTools(defineShoppingConfig('m', { maxSearchResults: 5 }), ['b', 'a']);
    const search = tools.find((t) => t.name === 'search_products')!;
    expect(schemaOf(search).properties.limit.maximum).toBe(5);
    expect(schemaOf(tools[0]).properties.skill_name.enum).toEqual(['a', 'b']);
  });

  it('The model never authors a displayed fact: presentation payloads carry ids and prose only', () => {
    const FORBIDDEN = ['price', 'image', 'image_url', 'rating', 'stock', 'in_stock', 'currency', 'total', 'subtotal', 'tracking_url', 'estimated_delivery'];
    const collect = (node: unknown, out: string[] = []): string[] => {
      if (Array.isArray(node)) node.forEach((n) => collect(n, out));
      else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (k === 'properties' && v && typeof v === 'object') out.push(...Object.keys(v));
          collect(v, out);
        }
      }
      return out;
    };
    for (const tool of buildTools(everything, SKILLS).filter((t) => PRESENTATION.includes(t.name))) {
      const props = collect(tool.input_schema);
      for (const f of FORBIDDEN) expect(props, `${tool.name} must not take ${f}`).not.toContain(f);
    }
  });

  it('There is no tool that places an order or moves money', () => {
    const all = names(buildTools(everything, SKILLS)).join(' ');
    expect(all).not.toMatch(/place_order|pay|charge|purchase|submit_order|complete_checkout/);
    const checkout = buildTools(everything, SKILLS).find((t) => t.name === 'checkout')!;
    expect(String(checkout.description)).toContain('it places no order and charges nothing');
  });

  it('An extension that collides with a built-in is refused, and a new one is appended last', () => {
    const ext = { name: 'present_signin', toolDefinition: () => ({ name: 'present_signin', description: 'x', input_schema: { type: 'object', properties: {} } }) };
    expect(names(buildTools(SHOPPING_CONFIG, SKILLS, [ext])).at(-1)).toBe('present_signin');
    expect(() => buildTools(SHOPPING_CONFIG, SKILLS, [{ ...ext, name: 'checkout', toolDefinition: () => ({ name: 'checkout' }) }])).toThrow(/collides/);
  });
});

// Opt-in: UPSTREAM_DIR=/path/to/commerce-agents npx vitest run lib/agent/shopping/tools. Every contract string the builder emits must
// occur in the upstream source (adjacent Python string literals joined), which proves the transcription is verbatim without running
// any upstream code.
const upstream = process.env.UPSTREAM_DIR;
describe.skipIf(!upstream || !existsSync(join(upstream, 'shopping-agent/core/shopping_agent/tools/registry.py')))('verbatim against upstream', () => {
  const read = (rel: string): string => readFileSync(join(upstream!, rel), 'utf8');
  const join_ = (src: string): string => src.replace(/"\s*\n\s*"/g, '').replace(/'\s*\n\s*'/g, '');
  const registry = (): string => join_(read('shopping-agent/core/shopping_agent/tools/registry.py'));

  const strings = (node: unknown, out: string[] = []): string[] => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach((n) => strings(n, out));
    else if (node && typeof node === 'object') Object.values(node).forEach((v) => strings(v, out));
    return out;
  };

  it('Every description, enum value and schema text occurs in registry.py', () => {
    const src = registry();
    const tools = buildTools(everything, SKILLS).filter((t) => !t.name.startsWith('web_'));
    const missing: string[] = [];
    for (const tool of tools) {
      const props = { ...schemaOf(tool).properties };
      delete props[STATUS_FIELD];
      for (const text of strings({ description: tool.description, props })) {
        if (text.length < 3 || SKILLS.includes(text)) continue;
        if (text.startsWith('Short heading for the ')) {
          if (!src.includes('Short heading for the ')) missing.push(text);
          continue;
        }
        if (!src.includes(text)) missing.push(`${tool.name}: ${text}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('The status line text equals execution.py', () => {
    const exec = join_(read('commerce-common/commerce_common/execution.py'));
    const status = (buildTools(everything, SKILLS)[1].input_schema as { properties: { status: { description: string; maxLength: number } } }).properties.status;
    expect(exec).toContain(status.description.replace('the customer', '{reader}'));
    expect(exec).toContain(`STATUS_MAX_CHARS = ${status.maxLength}`);
  });
});
