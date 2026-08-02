// The /assets quick-hit: source-agnostic asset search.
// Fans out across every connected library, merges results, and honestly
// reports per-source status: matched / searched-but-empty / not connected.

import { isMockMode } from '../mock.js';
import { getAdapters } from './adapters/index.js';
import { findMockAssetById, keywords, searchMockLibraryByTags } from './adapters/mock/index.js';
import { DRIVE_FILENAMES } from './fixtures/shared.js';
import type {
  AssetSearchResult,
  AssetSourceReport,
  MatchedAsset,
  ParsedBrief,
  RightsCheckResult,
} from './types.js';

const RIGHTS_BADGES: Record<string, string> = {
  cleared: 'CLEARED',
  expiring: 'EXPIRING',
  check: 'CHECK',
  unknown: 'UNKNOWN',
};

interface SourceHit {
  report: AssetSourceReport;
  assets: MatchedAsset[];
}

function mockCloudinarySource(query: string): SourceHit {
  const hits = searchMockLibraryByTags(query);
  return {
    report: {
      source: 'Cloudinary (built-in)',
      status: hits.length > 0 ? 'matched' : 'searched-empty',
      matchCount: hits.length,
      note: hits.length > 0
        ? `${hits.length} tag match${hits.length > 1 ? 'es' : ''} (visual search not indexed — tag search).`
        : 'Searched tags, no matches.',
    },
    assets: hits,
  };
}

function mockDriveSource(query: string): SourceHit {
  const terms = keywords(query);
  const hits = DRIVE_FILENAMES.filter((name) =>
    terms.some((t) => name.toLowerCase().includes(t)),
  );
  return {
    report: {
      source: 'Google Drive',
      status: hits.length > 0 ? 'matched' : 'searched-empty',
      matchCount: hits.length,
      note: hits.length > 0
        ? `${hits.length} filename match${hits.length > 1 ? 'es' : ''}.`
        : 'Searched, no filename matches — Drive searches filenames only. Photos dumped in as IMG_#### stay invisible until named or tagged.',
    },
    assets: [],
  };
}

function mockBynderSource(): SourceHit {
  return {
    report: {
      source: 'Bynder',
      status: 'not-connected',
      matchCount: 0,
      note: 'Not connected — plug in a DAM connector to include its results.',
    },
    assets: [],
  };
}

async function realLibrarySource(query: string): Promise<SourceHit> {
  const adapters = getAdapters();
  const parsed: ParsedBrief = {
    headline: query,
    subhead: 'asset quick-hit',
    kind: 'general',
    searchTags: keywords(query),
    scenario: 'general',
  };
  const caps = await adapters.imageLibrary.capabilities();
  if (!caps.tagSearch) {
    return {
      report: { source: `${adapters.imageLibrary.name} (configured library)`, status: 'not-connected', matchCount: 0, note: 'Asset library not configured — set CLOUDINARY_* or connect a DAM.' },
      assets: [],
    };
  }
  const hits = await adapters.imageLibrary.searchAssets(parsed);
  return {
    report: {
      source: `${adapters.imageLibrary.name} (configured library)`,
      status: hits.length > 0 ? 'matched' : 'searched-empty',
      matchCount: hits.length,
      note: hits.length > 0
        ? `${hits.length} match${hits.length > 1 ? 'es' : ''} via ${caps.visualSearch ? 'visual' : 'tag'} search.`
        : 'Searched, no matches.',
    },
    assets: hits,
  };
}

export async function searchAllAssetSources(query: string): Promise<AssetSearchResult> {
  const adapters = getAdapters();
  const trimmed = query.trim();

  const hits: SourceHit[] = isMockMode()
    ? [mockCloudinarySource(trimmed), mockDriveSource(trimmed), mockBynderSource()]
    : [
        await realLibrarySource(trimmed),
        { report: { source: 'Google Drive', status: 'not-connected', matchCount: 0, note: 'Drive connector not yet wired.' }, assets: [] },
        { report: { source: 'Bynder', status: 'not-connected', matchCount: 0, note: 'DAM MCP connector not yet wired.' }, assets: [] },
      ];

  const seen = new Set<string>();
  const merged = hits
    .flatMap((h) => h.assets)
    .filter((a) => (seen.has(a.id) ? false : (seen.add(a.id), true)));

  const enriched = await adapters.rights.enrichRights(merged);
  const assets = enriched.map((asset) => ({
    ...asset,
    derivatives: asset.derivatives.length > 0 ? asset.derivatives : adapters.imageLibrary.buildDerivatives(asset),
  }));

  return {
    query: trimmed,
    total: assets.length,
    assets,
    sources: hits.map((h) => h.report),
  };
}

export async function checkAssetRights(assetId: string): Promise<RightsCheckResult> {
  const adapters = getAdapters();
  const id = assetId.trim();

  if (isMockMode()) {
    const asset = findMockAssetById(id);
    if (!asset) {
      return { assetId: id, found: false, note: `No asset with id "${id}" in any connected source — not on file.` };
    }
    const [enriched] = await adapters.rights.enrichRights([asset]);
    return {
      assetId: id,
      found: true,
      source: 'Cloudinary (built-in)',
      status: enriched.rightsStatus,
      badge: RIGHTS_BADGES[enriched.rightsStatus] ?? 'UNKNOWN',
      photographer: enriched.photographer,
      rightsLabel: enriched.rightsLabel,
      expiresAt: enriched.rightsExpiresAt,
      note: enriched.rightsNote ??
        (enriched.rightsStatus === 'cleared'
          ? 'Rights cleared — metadata on file.'
          : enriched.rightsStatus === 'unknown'
            ? 'No rights metadata on file — flagged UNKNOWN.'
            : 'Rights require attention before publish.'),
    };
  }

  const all = await adapters.imageLibrary.listAssets().catch(() => [] as MatchedAsset[]);
  const asset = all.find((a) => a.id === id);
  if (!asset) {
    return { assetId: id, found: false, note: `No asset with id "${id}" in the connected library — not on file.` };
  }
  const [enriched] = await adapters.rights.enrichRights([asset]);
  return {
    assetId: id,
    found: true,
    source: adapters.imageLibrary.name,
    status: enriched.rightsStatus,
    badge: RIGHTS_BADGES[enriched.rightsStatus] ?? 'UNKNOWN',
    photographer: enriched.photographer,
    rightsLabel: enriched.rightsLabel,
    expiresAt: enriched.rightsExpiresAt,
    note: enriched.rightsNote ?? 'Rights metadata as embedded in the library.',
  };
}
