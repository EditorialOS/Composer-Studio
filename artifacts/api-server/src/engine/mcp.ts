// MCP tool implementations — the same engine the dashboard uses,
// exposed as agent-callable tools. The route handler is a thin wrapper.

import { getAdapters } from './adapters/index.js';
import { checkAssetRights, searchAllAssetSources } from './assets.js';
import { composePackage } from './compose.js';
import { composeNewsletter } from './newsletter.js';
import { getPackage, recordSend } from './store.js';
import type { SendDestination, SendRecord } from './types.js';

const DESTINATIONS: SendDestination[] = ['beehiiv', 'cms', 'download'];

export const MCP_TOOL_DESCRIPTORS = [
  {
    name: 'search_assets',
    description:
      'Source-agnostic asset quick-hit: searches every connected library, merges results, and honestly reports per-source status (matched / searched-but-empty / not connected). Rights badges + derivative crops included.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'What to look for, e.g. "apple pictures".' } },
      required: ['query'],
    },
  },
  {
    name: 'compose_package',
    description:
      'The full compose loop: brief → five-gate editorial evaluation → archive + assets + market context in parallel → rights + derivatives → package JSON (id, verdict, tabs payload).',
    inputSchema: {
      type: 'object',
      properties: { brief: { type: 'string', description: 'The story brief — one line to a full draft.' } },
      required: ['brief'],
    },
  },
  {
    name: 'check_rights',
    description:
      'Rights check for one asset id: badge (CLEARED/EXPIRING/CHECK/UNKNOWN), expiry, photographer, label — with "not on file" honesty when metadata or the asset itself is missing.',
    inputSchema: {
      type: 'object',
      properties: { asset_id: { type: 'string', description: 'Asset id, e.g. "lib-apple-orchard-row".' } },
      required: ['asset_id'],
    },
  },
  {
    name: 'compose_newsletter',
    description:
      'The newsletter batch workflow: paste a full multi-story edition → decompose into story atoms → per-story asset packages (search + rights + derivatives) → ONE hero recommendation (strongest cleared-rights asset, with reasoning).',
    inputSchema: {
      type: 'object',
      properties: {
        edition: {
          type: 'string',
          description: 'The full newsletter edition — markdown headings (## per story), HR-separated, or Subject:-line structure.',
        },
      },
      required: ['edition'],
    },
  },
  {
    name: 'send_package',
    description:
      'Send a composed package onward: beehiiv draft post, CMS draft, or download bundle (mock adapters in COMPOSER_MOCK=1).',
    inputSchema: {
      type: 'object',
      properties: {
        package_id: { type: 'string', description: 'Package id returned by compose_package.' },
        destination: { type: 'string', enum: DESTINATIONS, description: 'beehiiv | cms | download' },
      },
      required: ['package_id', 'destination'],
    },
  },
] as const;

export async function toolSearchAssets(query: string) {
  return searchAllAssetSources(query);
}

export async function toolComposePackage(brief: string, orgId: string) {
  const pkg = await composePackage({ brief, platforms: ['Newsletter'], archiveDepth: 'standard' }, orgId);
  return { id: pkg.id, verdict: pkg.evaluation.verdict, headline: pkg.headline, package: pkg };
}

export async function toolCheckRights(assetId: string) {
  return checkAssetRights(assetId);
}

export async function toolComposeNewsletter(edition: string, orgId: string) {
  const pkg = await composeNewsletter(edition, orgId);
  return {
    id: pkg.id,
    title: pkg.title,
    storyCount: pkg.storyCount,
    hero: pkg.hero
      ? { assetId: pkg.hero.assetId, storyTitle: pkg.hero.storyTitle, reasoning: pkg.hero.reasoning, rightsBadge: pkg.hero.asset.rightsStatus.toUpperCase() }
      : null,
    heroNote: pkg.heroNote,
    stories: pkg.stories.map((s) => ({
      title: s.atom.title,
      wordCount: s.atom.wordCount,
      assetCount: s.assets.length,
      rightsBadges: s.assets.map((a) => `${a.id}: ${a.rightsStatus.toUpperCase()}`),
      sources: s.sources,
      note: s.note,
    })),
    notes: pkg.notes,
    edition: pkg,
  };
}

export async function toolSendPackage(packageId: string, destination: string) {
  if (!DESTINATIONS.includes(destination as SendDestination)) {
    return { ok: false, note: `Unknown destination "${destination}" — expected one of: ${DESTINATIONS.join(', ')}.` };
  }
  const pkg = await getPackage(packageId);
  if (!pkg) {
    return { ok: false, note: `No package with id "${packageId}" — not on file. Run compose_package first.` };
  }
  const adapters = getAdapters();
  const result = await adapters.send.send(pkg, destination as SendDestination);
  const record: SendRecord = { ...result, id: `send-${Date.now().toString(36)}`, packageId: pkg.id, createdAt: new Date().toISOString() };
  await recordSend(record);
  return { ok: true, send: record };
}
