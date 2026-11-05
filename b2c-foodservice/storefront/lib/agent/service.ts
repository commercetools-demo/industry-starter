import 'server-only';
import { createAnthropicClient } from './anthropic-client';
import { DEFAULT_ASSISTANT_MODEL, SHOPPING_CONFIG } from './deployment';
import { type ModelClient, ShoppingAgent } from './runtime/orchestrator';
import type { StorefrontBackend } from './shopping/backend';
import { loadSkillRegistry } from './skills';

/**
 * The composition root for the assistant routes: the model client and the skills. The backend is built by the route layer (it reads the
 * shopper's cookie session and the storefront modules, which this directory may not import) and passed in (workstream T2, D-055).
 */

export function assistantConfig() {
  const model = process.env.ASSISTANT_MODEL?.trim();
  return model && model !== DEFAULT_ASSISTANT_MODEL ? { ...SHOPPING_CONFIG, model } : SHOPPING_CONFIG;
}

let modelClient: ModelClient | undefined;
function getModelClient(): ModelClient {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  modelClient ??= createAnthropicClient(key);
  return modelClient;
}

export function createAssistantAgent(backend: StorefrontBackend): ShoppingAgent {
  return new ShoppingAgent({
    backend,
    skills: loadSkillRegistry(),
    config: assistantConfig(),
    client: getModelClient(),
  });
}
