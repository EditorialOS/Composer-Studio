// Per-workspace integration keys. The UI stores these in workspace
// settings and sends them with each request; they override process env.
// Values are used in-memory for the duration of the request only — never
// persisted by the API server (the workspace DB owns persistence).

import type { Request } from 'express';

export interface WorkspaceKeys {
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  serperApiKey?: string;
  braveApiKey?: string;
  beehiivApiKey?: string;
  beehiivPublicationId?: string;
  cmsWebhookUrl?: string;
  anthropicApiKey?: string;
  anthropicModel?: string;
}

export const NO_KEYS: WorkspaceKeys = {};

function clean(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

/** Extract keys from a request body `keys` object (UI → REST shim). */
export function keysFromBody(body: unknown): WorkspaceKeys {
  const b = (body as Record<string, unknown> | null)?.['keys'] as Record<string, unknown> | undefined;
  if (!b || typeof b !== 'object') return NO_KEYS;
  return {
    cloudinaryCloudName: clean(b['cloudinaryCloudName']),
    cloudinaryApiKey: clean(b['cloudinaryApiKey']),
    cloudinaryApiSecret: clean(b['cloudinaryApiSecret']),
    serperApiKey: clean(b['serperApiKey']),
    braveApiKey: clean(b['braveApiKey']),
    beehiivApiKey: clean(b['beehiivApiKey']),
    beehiivPublicationId: clean(b['beehiivPublicationId']),
    cmsWebhookUrl: clean(b['cmsWebhookUrl']),
    anthropicApiKey: clean(b['anthropicApiKey']),
    anthropicModel: clean(b['anthropicModel']),
  };
}

/** Extract keys from X-Composer-Key-* headers (MCP / curl clients). */
export function keysFromHeaders(req: Request): WorkspaceKeys {
  const h = (name: string) => clean(req.headers[name.toLowerCase()]);
  return {
    cloudinaryCloudName: h('x-composer-key-cloud-name'),
    cloudinaryApiKey: h('x-composer-key-cloudinary-key'),
    cloudinaryApiSecret: h('x-composer-key-cloudinary-secret'),
    serperApiKey: h('x-composer-key-serper'),
    braveApiKey: h('x-composer-key-brave'),
    beehiivApiKey: h('x-composer-key-beehiiv'),
    beehiivPublicationId: h('x-composer-key-beehiiv-pub'),
    cmsWebhookUrl: h('x-composer-key-cms-webhook'),
    anthropicApiKey: h('x-composer-key-anthropic'),
    anthropicModel: h('x-composer-key-anthropic-model'),
  };
}
