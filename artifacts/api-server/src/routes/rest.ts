// REST shim — the UI's HTTP surface over the Composer engine. Every route
// is Bearer-authenticated, rate-limited, and accepts an optional per-request
// `keys` object (WorkspaceKeys) so a workspace can supply its own Cloudinary /
// Serper / beehiiv / CMS credentials without any server-side persistence.
//
// Express 5: this router is mounted on the SAME router level as the MCP route,
// and the parent app mounts that at "/api". So every path here is
// mount-relative ("/compose", not "/api/compose").

import { Router, type Request, type Response } from 'express';
import { isMockMode } from '../mock.js';
import { authenticate, type AuthResult } from '../engine/auth.js';
import { getAdapters } from '../engine/adapters/index.js';
import { keysFromBody, type WorkspaceKeys } from '../engine/adapters/keys.js';
import { composePackage } from '../engine/compose.js';
import { checkAssetRights, searchAllAssetSources } from '../engine/assets.js';
import { composeNewsletter } from '../engine/newsletter.js';
import { getPackage, listPackages, recordSend } from '../engine/store.js';
import { getPlan, getSubscription, PLANS } from '../engine/billing.js';
import type { ArchiveDepth, SendDestination, SendRecord } from '../engine/types.js';

const router = Router();

// ── Config ───────────────────────────────────────────────────

const DEFAULT_RPM = Number(process.env['RATE_LIMIT_RPM']) || 60;
const DEFAULT_COMPOSES_PER_DAY = Number(process.env['COMPOSES_PER_DAY']) || 200;
const ARCHIVE_DEPTHS: readonly ArchiveDepth[] = ['shallow', 'standard', 'deep'];
const DESTINATIONS: readonly SendDestination[] = ['beehiiv', 'cms', 'download'];

// Input size guards — prevent abuse and unexpected LLM costs.
const LIMITS = {
  brief: 10_000,
  edition: 100_000,
  query: 1_000,
  assetId: 500,
  packageId: 200,
} as const;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: 'unauthorized',
    message: 'Send Authorization: Bearer <key>. Use a minted API key, or set COMPOSER_API_KEY.',
  });
}

// ── In-memory rate limiter (per Bearer key) ──────────────────

interface Bucket {
  windowStart: number;
  count: number;
  dayStart: number;
  composeCount: number;
}

const buckets = new Map<string, Bucket>();

function bucketFor(key: string): Bucket {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { windowStart: now, count: 0, dayStart: now, composeCount: 0 };
    buckets.set(key, b);
  }
  if (now - b.windowStart >= 60_000) {
    b.windowStart = now;
    b.count = 0;
  }
  if (now - b.dayStart >= 86_400_000) {
    b.dayStart = now;
    b.composeCount = 0;
  }
  return b;
}

/** Per-minute request limit. Returns false (and responds 429) when exceeded. */
function underRequestLimit(key: string, res: Response, rpm: number): boolean {
  const b = bucketFor(key);
  b.count += 1;
  if (b.count > rpm) {
    res.status(429).json({
      error: 'rate_limited',
      message: `Rate limit exceeded — ${rpm} requests/min.`,
      limit: rpm,
    });
    return false;
  }
  return true;
}

async function limitsForOrg(orgId: string): Promise<{ rpm: number; composesPerDay: number }> {
  if (isMockMode()) {
    return { rpm: DEFAULT_RPM, composesPerDay: DEFAULT_COMPOSES_PER_DAY };
  }
  const subscription = await getSubscription(orgId);
  const plan = getPlan(subscription.plan);
  if (!plan) {
    return { rpm: DEFAULT_RPM, composesPerDay: DEFAULT_COMPOSES_PER_DAY };
  }
  return { rpm: plan.requestsPerMinute, composesPerDay: plan.composesPerDay };
}

// ── Handler wrapper (auth + rate limit + error handling) ─────

type GuardedHandler = (req: Request, res: Response, auth: AuthResult) => Promise<void> | void;

function guarded(handler: GuardedHandler) {
  return async (req: Request, res: Response): Promise<void> => {
    const auth = await authenticate(req);
    if (!auth) {
      unauthorized(res);
      return;
    }
    const limits = await limitsForOrg(auth.orgId);
    if (!underRequestLimit(auth.key, res, limits.rpm)) return;
    try {
      await handler(req, res, auth);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500).json({ error: 'internal_error', message: String(err) });
      }
    }
  };
}

/** Engine keys: none in mock mode (fixtures), else pulled from the body. */
function engineKeys(req: Request): WorkspaceKeys {
  return isMockMode() ? {} : keysFromBody(req.body);
}

function body(req: Request): Record<string, unknown> {
  return (req.body ?? {}) as Record<string, unknown>;
}

function tooLong(res: Response, field: string, max: number): void {
  res.status(400).json({ error: 'bad_request', message: `${field} must not exceed ${max} characters.` });
}

// ── Routes ───────────────────────────────────────────────────

router.get(
  '/capabilities',
  guarded(async (req, res, auth) => {
    const adapters = getAdapters(engineKeys(req));
    const [webSearch, imageLibrary, archive, send, llm, limits] = await Promise.all([
      adapters.webSearch.capabilities(),
      adapters.imageLibrary.capabilities(),
      adapters.archive.capabilities(),
      adapters.send.capabilities(),
      adapters.llm.capabilities(),
      limitsForOrg(auth.orgId),
    ]);
    res.json({
      mode: isMockMode() ? 'mock' : 'real',
      webSearch: { name: adapters.webSearch.name, ...webSearch },
      imageLibrary: { name: adapters.imageLibrary.name, ...imageLibrary },
      archive: { name: adapters.archive.name, ...archive },
      send: { name: adapters.send.name, ...send },
      llm: { name: adapters.llm.name, ...llm },
      rateLimit: { rpm: limits.rpm, composesPerDay: limits.composesPerDay },
      plans: PLANS,
    });
  }),
);

router.post(
  '/compose',
  guarded(async (req, res, auth) => {
    const b = body(req);
    const brief = typeof b['brief'] === 'string' ? b['brief'].trim() : '';
    if (!brief) {
      res.status(400).json({ error: 'bad_request', message: 'brief is required.' });
      return;
    }
    if (brief.length > LIMITS.brief) {
      tooLong(res, 'brief', LIMITS.brief);
      return;
    }
    const platforms =
      Array.isArray(b['platforms']) && b['platforms'].length > 0
        ? (b['platforms'] as unknown[]).filter((p): p is string => typeof p === 'string')
        : ['Newsletter'];
    const depthRaw = typeof b['archiveDepth'] === 'string' ? b['archiveDepth'] : 'standard';
    const archiveDepth: ArchiveDepth = ARCHIVE_DEPTHS.includes(depthRaw as ArchiveDepth)
      ? (depthRaw as ArchiveDepth)
      : 'standard';

    // Per-day compose limit — count and expose on every compose response.
    const limits = await limitsForOrg(auth.orgId);
    const bucket = bucketFor(auth.key);
    bucket.composeCount += 1;
    res.setHeader('X-Compose-Count', String(bucket.composeCount));
    res.setHeader('X-Compose-Limit', String(limits.composesPerDay));
    if (bucket.composeCount > limits.composesPerDay) {
      res.status(429).json({
        error: 'rate_limited',
        message: `Daily compose limit reached — ${limits.composesPerDay}/day.`,
        limit: limits.composesPerDay,
      });
      return;
    }

    const pkg = await composePackage(
      { brief, platforms: platforms.length > 0 ? platforms : ['Newsletter'], archiveDepth },
      auth.orgId,
      engineKeys(req),
    );
    res.json(pkg);
  }),
);

router.post(
  '/search-assets',
  guarded(async (req, res) => {
    const b = body(req);
    const query = typeof b['query'] === 'string' ? b['query'] : '';
    if (query.length > LIMITS.query) {
      tooLong(res, 'query', LIMITS.query);
      return;
    }
    res.json(await searchAllAssetSources(query, engineKeys(req)));
  }),
);

router.post(
  '/check-rights',
  guarded(async (req, res) => {
    const b = body(req);
    const assetId = typeof b['asset_id'] === 'string' ? b['asset_id'] : '';
    if (assetId.length > LIMITS.assetId) {
      tooLong(res, 'asset_id', LIMITS.assetId);
      return;
    }
    res.json(await checkAssetRights(assetId, engineKeys(req)));
  }),
);

router.post(
  '/newsletter',
  guarded(async (req, res, auth) => {
    const b = body(req);
    const edition = typeof b['edition'] === 'string' ? b['edition'] : '';
    if (!edition.trim()) {
      res.status(400).json({ error: 'bad_request', message: 'edition is required.' });
      return;
    }
    if (edition.length > LIMITS.edition) {
      tooLong(res, 'edition', LIMITS.edition);
      return;
    }
    res.json(await composeNewsletter(edition, auth.orgId, engineKeys(req)));
  }),
);

router.post(
  '/send',
  guarded(async (req, res) => {
    const b = body(req);
    const packageId = typeof b['package_id'] === 'string' ? b['package_id'] : '';
    if (packageId.length > LIMITS.packageId) {
      tooLong(res, 'package_id', LIMITS.packageId);
      return;
    }
    const destination = typeof b['destination'] === 'string' ? b['destination'] : '';

    const pkg = await getPackage(packageId);
    if (!pkg) {
      res.status(404).json({ error: 'not_found', message: `No package "${packageId}" in the store.` });
      return;
    }
    if (!DESTINATIONS.includes(destination as SendDestination)) {
      res.status(400).json({ error: 'bad_request', message: 'destination must be beehiiv | cms | download.' });
      return;
    }

    const dest = destination as SendDestination;
    const result = await getAdapters(engineKeys(req)).send.send(pkg, dest);
    const record: SendRecord = {
      id: `send-${Date.now().toString(36)}`,
      packageId: pkg.id,
      destination: dest,
      status: result.status,
      url: result.url,
      note: result.note,
      createdAt: new Date().toISOString(),
    };
    await recordSend(record);
    res.json(record);
  }),
);

router.get(
  '/packages',
  guarded(async (_req, res, auth) => {
    res.json(await listPackages(auth.orgId));
  }),
);

router.get(
  '/packages/:id',
  guarded(async (req, res) => {
    const id = String(req.params['id'] ?? '');
    if (id.length > LIMITS.packageId) {
      tooLong(res, 'package id', LIMITS.packageId);
      return;
    }
    const pkg = await getPackage(id);
    if (!pkg) {
      res.status(404).json({ error: 'not_found', message: `No package "${id}".` });
      return;
    }
    res.json(pkg);
  }),
);

export default router;
