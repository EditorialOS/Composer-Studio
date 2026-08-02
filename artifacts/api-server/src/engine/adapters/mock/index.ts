import type {
  ArchiveDepth,
  ArchiveResult,
  ComposeInput,
  ComposerPackage,
  GateEvaluation,
  MatchedAsset,
  ModelAdapter,
  ParsedBrief,
  RightsAdapter,
  ScenarioKey,
  SearchAdapter,
  AssetAdapter,
  SendAdapter,
  ArchiveAdapter,
  SendDestination,
  SendRecord,
  WorkspaceContextData,
} from '../../types.js';
import { withDerivatives } from '../../derivatives.js';
import { CASA_SOLEDAD } from '../../fixtures/casa-soledad.js';
import { NEWSLETTER_ASSETS } from '../../fixtures/newsletter.js';
import { NOTO_EARTHQUAKE } from '../../fixtures/noto-earthquake.js';
import { LIBRARY_EXTRAS, type FixtureScenario } from '../../fixtures/shared.js';

// ── Fixture routing ──────────────────────────────────────────

const FIXTURES: Record<Exclude<ScenarioKey, 'general'>, FixtureScenario> = {
  'casa-soledad': CASA_SOLEDAD,
  'noto-earthquake': NOTO_EARTHQUAKE,
};

export function detectScenario(brief: string): ScenarioKey {
  const b = brief.toLowerCase();
  if (/(casa soledad|oaxaca|boutique hotel|mezcal)/.test(b)) return 'casa-soledad';
  if (/(noto|earthquake|tsunami)/.test(b)) return 'noto-earthquake';
  return 'general';
}

export function getFixture(scenario: ScenarioKey): FixtureScenario | null {
  return scenario === 'general' ? null : FIXTURES[scenario];
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'need',
  'package', 'context', 'story', 'feature', 'brief', 'this', 'that', 'from',
]);

export function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8);
}

// ── Model adapter (mock) ─────────────────────────────────────

export class MockModelAdapter implements ModelAdapter {
  name = 'mock-editorial-director';

  async capabilities() {
    return { gateEval: true, provider: 'mock' };
  }

  async parseBrief(input: ComposeInput): Promise<ParsedBrief> {
    const scenario = detectScenario(input.brief);
    const fixture = getFixture(scenario);
    if (fixture) {
      return { ...fixture.parsed, scenario };
    }
    const firstLine = input.brief.split(/[.\n]/).map((s) => s.trim()).filter(Boolean)[0] ?? 'Untitled brief';
    return {
      headline: firstLine.length > 90 ? `${firstLine.slice(0, 87)}…` : firstLine,
      subhead: `${input.platforms.length || 1} platform${(input.platforms.length || 1) > 1 ? 's' : ''} · ${input.archiveDepth} archive depth`,
      kind: 'general',
      searchTags: keywords(input.brief),
      scenario,
    };
  }

  async evaluateGates({
    parsed,
    workspace,
  }: {
    parsed: ParsedBrief;
    workspace: WorkspaceContextData;
  }): Promise<GateEvaluation> {
    const fixture = getFixture(parsed.scenario);
    if (fixture) return fixture.evaluation;

    const briefText = `${parsed.headline} ${parsed.searchTags.join(' ')}`.toLowerCase();
    const themeHit = workspace.activeThemes.some((t) =>
      t.toLowerCase().split(/\s+/).some((w) => w.length > 3 && briefText.includes(w)),
    );
    const coverageOverlap = workspace.recentCoverage.find((c) =>
      c.toLowerCase().split(/\s+/).some((w) => w.length > 4 && briefText.includes(w)),
    );
    const calendarClash = workspace.calendar.find((c) =>
      c.toLowerCase().split(/\s+/).some((w) => w.length > 4 && briefText.includes(w)),
    );

    const gates: GateEvaluation['gates'] = [
      {
        gate: 'Theme alignment',
        status: themeHit ? 'pass' : 'warn',
        note: themeHit
          ? `Advances active theme: ${workspace.activeThemes.find((t) => t.toLowerCase().split(/\s+/).some((w) => w.length > 3 && briefText.includes(w)))}`
          : 'No clear link to active themes — name the thesis explicitly',
      },
      {
        gate: 'Angle differentiation',
        status: coverageOverlap ? 'warn' : 'pass',
        note: coverageOverlap
          ? `Possible overlap with recent coverage: "${coverageOverlap.slice(0, 60)}"`
          : 'No overlap detected with recent coverage',
      },
      {
        gate: 'Audience need',
        status: 'warn',
        note: 'Audience link assumed, not demonstrated — sharpen in revision',
      },
      {
        gate: 'Production reality',
        status: 'pass',
        note: 'Scope realistic for current capacity',
      },
      {
        gate: 'Calendar fit',
        status: calendarClash ? 'warn' : 'pass',
        note: calendarClash
          ? `Competes with scheduled item: "${calendarClash.slice(0, 60)}"`
          : 'No calendar conflicts detected',
      },
    ];

    const hasWarn = gates.some((g) => g.status !== 'pass');
    return {
      gates,
      verdict: hasWarn ? 'REVISE' : 'APPROVED',
      verdictSummary: hasWarn
        ? 'The brief clears production and calendar but needs a sharper thesis before it earns a slot.'
        : 'All five gates pass against current workspace context. Cleared to assemble and publish.',
      requiredRevisions: hasWarn
        ? [
            'Clarify the unique thesis in one sentence',
            'Name what is new versus recent coverage',
            'Tie delivery scope to current production capacity',
          ]
        : [],
      editorNote:
        'Heuristic mock evaluation — connect an LLM provider (OPENAI_API_KEY / ANTHROPIC_API_KEY) for full Editorial Director reasoning.',
    };
  }

  async packageContent(parsed: ParsedBrief) {
    const fixture = getFixture(parsed.scenario);
    if (fixture) {
      return {
        deliverables: fixture.deliverables,
        workflow: fixture.workflow,
        worked: fixture.worked,
        didntWork: fixture.didntWork,
        assetSearchNote: fixture.assetSearchNote,
      };
    }
    return {
      deliverables: [
        { title: 'Article context block', detail: 'Pre-written context section with key stats and linked sources, formatted for CMS injection.', color: '#534AB7' },
        { title: 'Social media kit', detail: 'Platform-ready posts with copy, suggested asset + crop, and alt text. Voice-matched to workspace notes.', color: '#1D9E75' },
        { title: 'Photo asset sheet', detail: 'Matched assets with usage rights, photographer credits, and pre-generated derivatives.', color: '#D85A30' },
        { title: 'Source + contact sheet', detail: 'Sources used in this package, each with a linked URL.', color: '#888780' },
      ],
      workflow: [
        { title: 'Editor triggers package', detail: "One brief. That's the entire input." },
        { title: 'Editorial Director evaluates brief', detail: 'Five-gate assessment against active themes, recent coverage, voice, calendar.' },
        { title: 'Archive search', detail: 'Prior coverage and institutional notes, when an archive is connected.' },
        { title: 'Asset matching', detail: 'Tag search against the library; derivatives generated on the fly.' },
        { title: 'Package assembly', detail: 'Facts without source URLs dropped. Gaps named. Package ships.' },
      ],
      worked: ['Five-gate evaluation ran against real workspace context', 'Tag search + derivative generation', 'Source-URL filtration at assembly'],
      didntWork: ['Visual search not indexed — fell back to tag search', 'Generic brief — connect a live search provider for sharper market context'],
    };
  }
}

// ── Asset adapter (mock) ─────────────────────────────────────

const MOCK_LIBRARY: MatchedAsset[] = [
  ...CASA_SOLEDAD.assets,
  ...NOTO_EARTHQUAKE.assets,
  ...LIBRARY_EXTRAS,
  ...NEWSLETTER_ASSETS,
].map(withDerivatives);

export class MockAssetAdapter implements AssetAdapter {
  name = 'mock-cloudinary';

  async capabilities() {
    return { tagSearch: true, visualSearch: false, derivatives: true, rightsMetadata: true };
  }

  async searchAssets(parsed: ParsedBrief): Promise<MatchedAsset[]> {
    const fixture = getFixture(parsed.scenario);
    if (fixture) return fixture.assets.map(withDerivatives);
    const tags = new Set(parsed.searchTags);
    const hits = MOCK_LIBRARY.filter((a) => a.tags.some((t) => tags.has(t)));
    return hits.length > 0 ? hits : MOCK_LIBRARY.slice(0, 3);
  }

  async listAssets(): Promise<MatchedAsset[]> {
    return MOCK_LIBRARY;
  }

  buildDerivatives(asset: MatchedAsset) {
    return withDerivatives(asset).derivatives;
  }
}

export function searchMockLibraryByTags(query: string): MatchedAsset[] {
  const tags = new Set(keywords(query));
  return MOCK_LIBRARY.filter((a) => a.tags.some((t) => tags.has(t)));
}

export function findMockAssetById(id: string): MatchedAsset | null {
  return MOCK_LIBRARY.find((a) => a.id === id) ?? null;
}

// ── Archive adapter (mock) ───────────────────────────────────

export class MockArchiveAdapter implements ArchiveAdapter {
  name = 'mock-drive';

  async capabilities() {
    return { connected: true, deepSearch: true };
  }

  async searchArchive(parsed: ParsedBrief, depth: ArchiveDepth): Promise<ArchiveResult> {
    const fixture = getFixture(parsed.scenario);
    if (fixture) {
      if (!fixture.archive.connected) return fixture.archive;
      return {
        ...fixture.archive,
        adapterName: this.name,
        note: depth === 'deep' ? 'Deep archive sweep: institutional notes included.' : undefined,
      };
    }
    return {
      connected: true,
      adapterName: this.name,
      findings: [],
      metrics: [],
      note: 'No prior coverage in the mock archive matched this brief.',
    };
  }
}

// ── Search adapter (mock) ────────────────────────────────────

export class MockSearchAdapter implements SearchAdapter {
  name = 'mock-web-search';

  async capabilities() {
    return { webSearch: true, provider: 'mock' };
  }

  async searchMarketContext(parsed: ParsedBrief) {
    const fixture = getFixture(parsed.scenario);
    if (fixture) {
      return {
        available: true,
        intro: fixture.marketIntro,
        competitors: fixture.competitors,
        facts: fixture.marketFacts,
        callout: fixture.marketCallout,
      };
    }
    return {
      available: true,
      intro: 'Mock market scan for this brief — connect a search provider (Tavily, Brave, Perplexity) for live results:',
      competitors: [],
      facts: [
        { text: `Background reading for "${parsed.headline}" would be pulled from a live search provider in production.`, sourceName: 'example.com', sourceUrl: 'https://example.com/' },
        { text: 'Competitive coverage scan runs against your configured search adapter.', sourceName: 'example.com', sourceUrl: 'https://example.com/search' },
        { text: 'An unsourced claim the mock adapter returned without provenance.' },
      ],
      callout: 'Every fact in a package must carry a source URL. Facts without one are dropped at assembly — no URL, no fact.',
    };
  }
}

// ── Rights adapter (mock) ────────────────────────────────────

export class MockRightsAdapter implements RightsAdapter {
  name = 'mock-xmp-reader';

  async capabilities() {
    return { embeddedMetadata: true, expiryTracking: true };
  }

  async enrichRights(assets: MatchedAsset[]): Promise<MatchedAsset[]> {
    return assets.map((asset) =>
      asset.rightsStatus === 'unknown' && !asset.rightsNote
        ? { ...asset, rightsNote: 'No rights metadata embedded — not on file.' }
        : asset,
    );
  }
}

// ── Send adapter (mock) ──────────────────────────────────────

export class MockSendAdapter implements SendAdapter {
  name = 'mock-send';

  async capabilities() {
    return { beehiivDraft: true, cmsDraft: true, downloadAll: true };
  }

  async send(
    pkg: ComposerPackage,
    destination: SendDestination,
  ): Promise<Omit<SendRecord, 'id' | 'packageId' | 'createdAt'>> {
    switch (destination) {
      case 'beehiiv':
        return { destination, status: 'draft-created', url: `https://app.beehiiv.com/mock/drafts/${pkg.id}`, note: `Draft post created in beehiiv (mock): "${pkg.headline}".` };
      case 'cms':
        return { destination, status: 'draft-created', url: `https://cms.example.com/mock/posts/${pkg.id}`, note: `CMS draft created (mock): "${pkg.headline}".` };
      case 'download':
        return { destination, status: 'download-ready', url: `/package/${pkg.id}#download`, note: 'All deliverables + derivative URLs bundled (mock zip).' };
    }
  }
}
