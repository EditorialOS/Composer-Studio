import { getAdapters } from './adapters/index.js';
import type {
  CapabilityNote,
  ComposeInput,
  ComposerPackage,
  MarketContext,
  MemoryEntry,
} from './types.js';
import { appendMemory, getPackage, getWorkspaceContextData, savePackage } from './store.js';

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48);
  return slug || 'package';
}

async function uniquePackageId(base: string): Promise<string> {
  if (!(await getPackage(base))) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!(await getPackage(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * The compose loop:
 *   parse brief → five-gate editorial evaluation → PARALLEL archive +
 *   asset + market search → rights enrichment + derivatives → source-URL
 *   filtration → assemble Package → log to memory.
 */
export async function composePackage(
  input: ComposeInput,
  orgId: string,
): Promise<ComposerPackage> {
  const adapters = getAdapters();
  const startedAt = Date.now();

  const parsed = await adapters.llm.parseBrief(input);
  const workspace = await getWorkspaceContextData(orgId);
  const evaluation = await adapters.llm.evaluateGates({ parsed, workspace });

  const [archive, rawAssets, marketRaw, assetCaps] = await Promise.all([
    adapters.archive.searchArchive(parsed, input.archiveDepth),
    adapters.imageLibrary.searchAssets(parsed),
    adapters.webSearch.searchMarketContext(parsed),
    adapters.imageLibrary.capabilities(),
  ]);

  const enriched = await adapters.rights.enrichRights(rawAssets);
  const assets = enriched.map((asset) => ({
    ...asset,
    derivatives: adapters.imageLibrary.buildDerivatives(asset),
  }));

  // Filtration — no URL, no fact.
  const facts = marketRaw.facts.filter(
    (fact) => typeof fact.sourceUrl === 'string' && fact.sourceUrl.length > 0,
  );
  const droppedFactCount = marketRaw.facts.length - facts.length;

  const market: MarketContext = {
    intro: marketRaw.intro,
    competitors: marketRaw.competitors,
    facts,
    droppedFactCount,
    callout: marketRaw.callout,
  };

  const capabilityNotes: CapabilityNote[] = [];
  if (!marketRaw.available) {
    capabilityNotes.push({ area: 'search', tone: 'gap', note: marketRaw.note ?? 'Web search unavailable — market context skipped.' });
  } else {
    capabilityNotes.push({ area: 'search', tone: 'ok', note: 'Market context pulled via web search adapter.' });
  }
  if (!assetCaps.visualSearch) {
    capabilityNotes.push({ area: 'assets', tone: 'warn', note: 'Visual search not indexed — fell back to tag search.' });
  }
  if (assets.length === 0) {
    capabilityNotes.push({ area: 'assets', tone: 'gap', note: 'No assets matched this brief.' });
  }
  if (!archive.connected) {
    capabilityNotes.push({ area: 'archive', tone: 'gap', note: archive.note ?? 'No archive configured.' });
  }
  const unknownRights = assets.filter((a) => a.rightsStatus === 'unknown').length;
  if (unknownRights > 0) {
    capabilityNotes.push({ area: 'rights', tone: 'warn', note: `${unknownRights} asset${unknownRights > 1 ? 's' : ''} with no rights metadata on file — flagged UNKNOWN.` });
  }
  if (droppedFactCount > 0) {
    capabilityNotes.push({ area: 'search', tone: 'warn', note: `${droppedFactCount} market-context fact${droppedFactCount > 1 ? 's' : ''} dropped — no source URL (no URL, no fact).` });
  }

  const content = await adapters.llm.packageContent(parsed);
  const id = await uniquePackageId(
    parsed.scenario !== 'general' ? parsed.scenario : slugify(parsed.headline),
  );

  const pkg: ComposerPackage = {
    id,
    orgId,
    createdAt: new Date().toISOString(),
    brief: input.brief,
    platforms: input.platforms,
    archiveDepth: input.archiveDepth,
    kind: parsed.kind,
    badge: parsed.badge,
    headline: parsed.headline,
    subhead: parsed.subhead,
    evaluation,
    assets,
    assetSearchNote: content.assetSearchNote,
    archive,
    market,
    deliverables: content.deliverables,
    workflow: content.workflow,
    provenance: {
      worked: content.worked,
      didntWork: content.didntWork,
      capabilityNotes,
      generationMs: Date.now() - startedAt,
    },
  };

  await savePackage(pkg);

  const lanesTaken = [
    'editorial-gate',
    ...(archive.connected && (archive.findings.length > 0 || archive.metrics.length > 0) ? ['archive'] : []),
    ...(assets.length > 0 ? ['assets'] : []),
    ...(facts.length > 0 || market.competitors.length > 0 ? ['market-context'] : []),
  ];
  const rightsFlagged = assets
    .filter((a) => a.rightsStatus !== 'cleared')
    .map((a) => `${a.photographer ?? a.id}: ${a.rightsStatus.toUpperCase()}`);

  const memoryEntry: MemoryEntry = {
    id: `mem-${id}`,
    packageId: id,
    topic: pkg.headline,
    createdAt: pkg.createdAt,
    lanesTaken,
    rightsFlagged,
    verdict: evaluation.verdict,
    platforms: input.platforms,
  };
  await appendMemory(orgId, memoryEntry);

  return pkg;
}
