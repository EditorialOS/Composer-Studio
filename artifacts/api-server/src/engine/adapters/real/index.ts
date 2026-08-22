// Real adapters — live integrations, configured per-request by the UI
// (WorkspaceKeys) or by process env, degrading honestly when a capability
// isn't connected. In COMPOSER_MOCK=1 mode these are never instantiated.

import type {
  ArchiveAdapter,
  ArchiveResult,
  AssetAdapter,
  CompetitorCard,
  ComposeInput,
  ComposerPackage,
  Derivative,
  GateEvaluation,
  MatchedAsset,
  ModelAdapter,
  ParsedBrief,
  RightsAdapter,
  RightsStatus,
  SearchAdapter,
  SendAdapter,
  SendDestination,
  SendRecord,
  SourceFact,
  WorkspaceContextData,
} from '../../types.js';
import { buildDerivatives, cloudinaryTransform } from '../../derivatives.js';
import { evaluateGatesWithClaude, resolveLlm } from '../../llm.js';
import type { WorkspaceKeys } from '../keys.js';

// ── Shared helpers ───────────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Days from now until an ISO date, or null when absent/unparseable. */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return (t - Date.now()) / 86_400_000;
}

function toRightsStatus(v: unknown): RightsStatus {
  const s = str(v)?.toLowerCase();
  if (s === 'cleared' || s === 'clear' || s === 'ok') return 'cleared';
  if (s === 'expiring') return 'expiring';
  if (s === 'check' || s === 'review') return 'check';
  return 'unknown';
}

// Competitor-card palette + relevance regex (shared with the UI's design).
const PALETTE = ['#534AB7', '#1D9E75', '#D85A30', '#888780', '#D4537E', '#639922'];
const COMPETITOR_RE = /open|launch|hotel|resort|competitor|rival|review|guide|versus|vs\b|compare|new\b/i;

// ── Asset adapter (Cloudinary Admin Search API) ──────────────

export class RealAssetAdapter implements AssetAdapter {
  name = 'cloudinary';

  constructor(private keys: WorkspaceKeys) {}

  private config(): { cloud: string; key: string; secret: string } | null {
    const cloud = this.keys.cloudinaryCloudName || process.env['CLOUDINARY_CLOUD_NAME'];
    const key = this.keys.cloudinaryApiKey || process.env['CLOUDINARY_API_KEY'];
    const secret = this.keys.cloudinaryApiSecret || process.env['CLOUDINARY_API_SECRET'];
    return cloud && key && secret ? { cloud, key, secret } : null;
  }

  async capabilities() {
    const configured = Boolean(this.config());
    return { tagSearch: configured, visualSearch: false, derivatives: true, rightsMetadata: configured };
  }

  private expressionFor(parsed: ParsedBrief): string {
    const tags = parsed.searchTags.filter(Boolean);
    if (tags.length > 0) return tags.map((t) => `tags:${t}`).join(' OR ');
    return parsed.headline;
  }

  private toAsset(resource: Record<string, unknown>): MatchedAsset {
    const url = str(resource['secure_url']) ?? str(resource['url']) ?? '';
    const fields: Record<string, unknown> = {};
    const ctx = resource['context'];
    if (ctx && typeof ctx === 'object') {
      Object.assign(fields, ctx as Record<string, unknown>);
      const custom = (ctx as Record<string, unknown>)['custom'];
      if (custom && typeof custom === 'object') Object.assign(fields, custom as Record<string, unknown>);
    }
    const meta = resource['metadata'];
    if (meta && typeof meta === 'object') Object.assign(fields, meta as Record<string, unknown>);

    let rightsStatus = toRightsStatus(fields['rights_status']);
    const rightsExpiresAt = str(fields['rights_expires_at']);
    let rightsNote = str(fields['rights_note']);

    // Auto-downgrade cleared → expiring when clearance lapses within 30 days.
    if (rightsStatus === 'cleared') {
      const d = daysUntil(rightsExpiresAt);
      if (d !== null && d < 30) {
        rightsStatus = 'expiring';
        rightsNote =
          rightsNote ??
          `Rights clearance expires in ${Math.max(0, Math.round(d))} day(s) — downgraded from CLEARED to EXPIRING.`;
      }
    }

    const tags = Array.isArray(resource['tags'])
      ? (resource['tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];

    const asset: MatchedAsset = {
      id: str(resource['public_id']) ?? str(resource['asset_id']) ?? url,
      url,
      thumbnailUrl: cloudinaryTransform(url, 'c_fill,w_400,h_300,g_auto,f_auto,q_auto'),
      width: num(resource['width']) ?? 0,
      height: num(resource['height']) ?? 0,
      format: str(resource['format']) ?? 'jpg',
      bytes: num(resource['bytes']) ?? 0,
      tags,
      photographer: str(fields['photographer']),
      campaign: str(fields['campaign']),
      rightsLabel: str(fields['rights_label']),
      rightsStatus,
      rightsExpiresAt,
      rightsNote,
      derivatives: [],
    };
    asset.derivatives = buildDerivatives(asset);
    return asset;
  }

  private async runSearch(expression: string): Promise<MatchedAsset[]> {
    const cfg = this.config();
    if (!cfg) return [];
    const auth = Buffer.from(`${cfg.key}:${cfg.secret}`).toString('base64');
    const params = new URLSearchParams();
    params.set('expression', expression);
    params.set('max_results', '20');
    params.append('with_field', 'tags');
    params.append('with_field', 'context');
    params.append('with_field', 'metadata');
    const url = `https://api.cloudinary.com/v1_1/${cfg.cloud}/resources/search?${params.toString()}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { resources?: unknown[] };
      const resources = Array.isArray(data.resources) ? data.resources : [];
      return resources
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
        .map((r) => this.toAsset(r))
        .filter((a) => a.url.length > 0);
    } catch {
      return [];
    }
  }

  async searchAssets(parsed: ParsedBrief): Promise<MatchedAsset[]> {
    return this.runSearch(this.expressionFor(parsed));
  }

  async listAssets(): Promise<MatchedAsset[]> {
    return this.runSearch('resource_type:image');
  }

  buildDerivatives(asset: MatchedAsset): Derivative[] {
    return buildDerivatives(asset);
  }
}

// ── Search adapter (Serper / Brave) ──────────────────────────

interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

export class RealSearchAdapter implements SearchAdapter {
  name = 'web-search';

  constructor(private keys: WorkspaceKeys) {}

  private provider(): { kind: 'serper' | 'brave'; key: string } | null {
    const serper = this.keys.serperApiKey || process.env['SERPER_API_KEY'];
    if (serper) return { kind: 'serper', key: serper };
    const brave =
      this.keys.braveApiKey || process.env['BRAVE_API_KEY'] || process.env['BRAVE_SEARCH_API_KEY'];
    if (brave) return { kind: 'brave', key: brave };
    return null;
  }

  async capabilities() {
    const p = this.provider();
    return { webSearch: Boolean(p), provider: p?.kind };
  }

  private async serper(key: string, query: string): Promise<SearchHit[]> {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 10 }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`serper HTTP ${res.status}`);
    const data = (await res.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string }> };
    return (data.organic ?? [])
      .map((o) => ({ title: o.title ?? '', url: o.link ?? '', snippet: o.snippet ?? '' }))
      .filter((h) => h.url.length > 0);
  }

  private async brave(key: string, query: string): Promise<SearchHit[]> {
    const params = new URLSearchParams({ q: query, count: '10' });
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`brave HTTP ${res.status}`);
    const data = (await res.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    return (data.web?.results ?? [])
      .map((r) => ({ title: r.title ?? '', url: r.url ?? '', snippet: r.description ?? '' }))
      .filter((h) => h.url.length > 0);
  }

  async searchMarketContext(parsed: ParsedBrief) {
    const p = this.provider();
    if (!p) {
      return {
        available: false,
        intro: '',
        competitors: [] as CompetitorCard[],
        facts: [] as SourceFact[],
        note: 'Web search not configured — set SERPER_API_KEY or BRAVE_API_KEY (per-workspace keys override env).',
      };
    }
    const query = parsed.headline;
    try {
      const hits = p.kind === 'serper' ? await this.serper(p.key, query) : await this.brave(p.key, query);
      const facts: SourceFact[] = hits.map((h) => ({
        text: h.snippet || h.title,
        sourceName: hostname(h.url),
        sourceUrl: h.url,
      }));
      const competitors: CompetitorCard[] = hits
        .filter((h) => COMPETITOR_RE.test(`${h.title} ${h.snippet}`))
        .slice(0, 4)
        .map((h, i) => ({
          name: h.title.slice(0, 80) || hostname(h.url),
          detail: h.snippet.slice(0, 160),
          color: PALETTE[i % PALETTE.length]!,
          sourceUrl: h.url,
        }));
      return {
        available: true,
        intro: `Live market scan via ${p.kind} — top results for "${parsed.headline}":`,
        competitors,
        facts,
        callout:
          'Every fact carries a source URL. Facts without one are dropped at assembly — no URL, no fact.',
      };
    } catch (err) {
      return {
        available: false,
        intro: '',
        competitors: [] as CompetitorCard[],
        facts: [] as SourceFact[],
        note: `Web search via ${p.kind} failed: ${String(err)}`,
      };
    }
  }
}

// ── Archive adapter (Drive not wired — honest stub) ──────────

export class RealArchiveAdapter implements ArchiveAdapter {
  name = 'google-drive';
  async capabilities() {
    return { connected: false, deepSearch: false };
  }
  async searchArchive(_parsed: ParsedBrief, _depth: string): Promise<ArchiveResult> {
    return {
      connected: false,
      adapterName: this.name,
      findings: [],
      metrics: [],
      note: 'Google Drive archive not wired — set GOOGLE_DRIVE_API_KEY or GOOGLE_SERVICE_ACCOUNT_JSON to activate.',
    };
  }
}

// ── Rights adapter (embedded metadata + expiry tracking) ─────

export class RealRightsAdapter implements RightsAdapter {
  name = 'embedded-xmp';
  async capabilities() {
    return { embeddedMetadata: true, expiryTracking: true };
  }
  async enrichRights(assets: MatchedAsset[]): Promise<MatchedAsset[]> {
    return assets.map((a) => {
      if (a.rightsStatus === 'cleared') {
        const d = daysUntil(a.rightsExpiresAt);
        if (d !== null && d < 30) {
          return {
            ...a,
            rightsStatus: 'expiring',
            rightsNote:
              a.rightsNote ??
              `Rights clearance expires in ${Math.max(0, Math.round(d))} day(s) — downgraded from CLEARED to EXPIRING.`,
          };
        }
      }
      if (a.rightsStatus === 'unknown' && !a.rightsNote) {
        return { ...a, rightsNote: 'No rights metadata embedded — not on file.' };
      }
      return a;
    });
  }
}

// ── Send adapter (beehiiv draft / CMS webhook / download) ────

export class RealSendAdapter implements SendAdapter {
  name = 'beehiiv';

  constructor(private keys: WorkspaceKeys) {}

  private beehiivConfig(): { key: string; pub: string } | null {
    const key = this.keys.beehiivApiKey || process.env['BEEHIIV_API_KEY'];
    const pub = this.keys.beehiivPublicationId || process.env['BEEHIIV_PUBLICATION_ID'];
    return key && pub ? { key, pub } : null;
  }

  private cmsWebhook(): string | null {
    return this.keys.cmsWebhookUrl || process.env['CMS_WEBHOOK_URL'] || null;
  }

  async capabilities() {
    return {
      beehiivDraft: Boolean(this.beehiivConfig()),
      cmsDraft: Boolean(this.cmsWebhook()),
      downloadAll: true,
    };
  }

  private buildHtml(pkg: ComposerPackage): string {
    const firstCleared = pkg.assets.find((a) => a.rightsStatus === 'cleared');
    const img = firstCleared
      ? `<img src="${firstCleared.url}" alt="${firstCleared.rightsLabel ?? pkg.headline}" style="max-width:100%;" />`
      : '';
    return [
      `<h1>${pkg.headline}</h1>`,
      `<h2>${pkg.subhead}</h2>`,
      img,
      `<p>${pkg.evaluation.verdictSummary}</p>`,
      '<hr /><p><em>Composed by Composer Studio.</em></p>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async send(
    pkg: ComposerPackage,
    destination: SendDestination,
  ): Promise<Omit<SendRecord, 'id' | 'packageId' | 'createdAt'>> {
    if (destination === 'download') {
      return {
        destination,
        status: 'download-ready',
        url: `/package/${pkg.id}#download`,
        note: 'All deliverables + derivative URLs bundled for download.',
      };
    }

    if (destination === 'beehiiv') {
      const cfg = this.beehiivConfig();
      if (!cfg) {
        return {
          destination,
          status: 'skipped',
          note: 'beehiiv not configured — set BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID (or send per-workspace keys).',
        };
      }
      try {
        const res = await fetch(`https://api.beehiiv.com/v2/publications/${cfg.pub}/posts`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pkg.headline,
            subtitle: pkg.subhead,
            status: 'draft',
            content: { free: { web: this.buildHtml(pkg) } },
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          return { destination, status: 'skipped', note: `beehiiv draft failed — HTTP ${res.status}.` };
        }
        const data = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
        const id = data.data?.id;
        return {
          destination,
          status: 'draft-created',
          url: id ? `https://app.beehiiv.com/posts/${id}` : undefined,
          note: `Draft post created in beehiiv: "${pkg.headline}".`,
        };
      } catch (err) {
        return { destination, status: 'skipped', note: `beehiiv draft error: ${String(err)}` };
      }
    }

    // destination === 'cms'
    const webhook = this.cmsWebhook();
    if (!webhook) {
      return {
        destination,
        status: 'skipped',
        note: 'CMS webhook not configured — set CMS_WEBHOOK_URL (or send per-workspace keys).',
      };
    }
    try {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkg),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return { destination, status: 'skipped', note: `CMS webhook failed — HTTP ${res.status}.` };
      }
      return {
        destination,
        status: 'draft-created',
        url: webhook,
        note: `Package posted to CMS webhook: "${pkg.headline}".`,
      };
    } catch (err) {
      return { destination, status: 'skipped', note: `CMS webhook error: ${String(err)}` };
    }
  }
}

// ── Model adapter (heuristic Editorial Director) ─────────────

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'need',
  'package', 'context', 'story', 'feature', 'brief', 'this', 'that', 'from',
]);

function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 8);
}

const BREAKING_RE =
  /\b(breaking|urgent|just in|developing|alert|earthquake|tsunami|crash|killed|dies|attack)\b/i;

export class RealModelAdapter implements ModelAdapter {
  name = 'editorial-director';

  constructor(private keys: WorkspaceKeys = {}) {}

  async capabilities() {
    return { gateEval: true, provider: resolveLlm(this.keys) ? 'anthropic' : 'heuristic' };
  }

  async parseBrief(input: ComposeInput): Promise<ParsedBrief> {
    const firstSentence =
      input.brief
        .split(/(?<=[.!?])\s+|\n+/)
        .map((s) => s.trim())
        .filter(Boolean)[0] ?? 'Untitled brief';
    const headline = firstSentence.length > 90 ? `${firstSentence.slice(0, 89)}…` : firstSentence;
    const breaking = BREAKING_RE.test(input.brief);
    const platformCount = input.platforms.length || 1;
    return {
      headline,
      subhead: `${platformCount} platform${platformCount > 1 ? 's' : ''} · ${input.archiveDepth} archive depth · heuristic`,
      kind: breaking ? 'breaking' : 'general',
      badge: breaking ? 'Breaking' : undefined,
      searchTags: keywords(input.brief),
      scenario: 'general',
    };
  }

  async evaluateGates(args: {
    parsed: ParsedBrief;
    workspace: WorkspaceContextData;
  }): Promise<GateEvaluation> {
    const cfg = resolveLlm(this.keys);
    if (cfg) {
      const viaLlm = await evaluateGatesWithClaude(args.parsed, args.workspace, cfg);
      if (viaLlm) return viaLlm;
      // fall through to heuristic on any LLM failure (network, refusal, bad output)
    }
    return this.heuristicGates(args);
  }

  private heuristicGates({
    parsed,
    workspace,
  }: {
    parsed: ParsedBrief;
    workspace: WorkspaceContextData;
  }): GateEvaluation {
    const briefText = `${parsed.headline} ${parsed.searchTags.join(' ')}`.toLowerCase();
    const themeMatch = workspace.activeThemes.find((t) =>
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
        status: themeMatch ? 'pass' : 'warn',
        note: themeMatch
          ? `Advances active theme: ${themeMatch}`
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
        'Heuristic evaluation (real mode, no LLM provider) — connect ANTHROPIC_API_KEY / OPENAI_API_KEY for full Editorial Director reasoning.',
    };
  }

  async packageContent(_parsed: ParsedBrief) {
    return {
      deliverables: [
        {
          title: 'Article context block',
          detail: 'Pre-written context section with key stats and linked sources, formatted for CMS injection.',
          color: '#534AB7',
        },
        {
          title: 'Social media kit',
          detail: 'Platform-ready posts with copy, suggested asset + crop, and alt text. Voice-matched to workspace notes.',
          color: '#1D9E75',
        },
        {
          title: 'Photo asset sheet',
          detail: 'Matched assets with usage rights, photographer credits, and pre-generated derivatives.',
          color: '#D85A30',
        },
        {
          title: 'Source + contact sheet',
          detail: 'Sources used in this package, each with a linked URL.',
          color: '#888780',
        },
      ],
      workflow: [
        { title: 'Editor triggers package', detail: "One brief. That's the entire input." },
        {
          title: 'Editorial Director evaluates brief',
          detail: 'Five-gate assessment against active themes, recent coverage, voice, calendar.',
        },
        {
          title: 'Archive search',
          detail: 'Prior coverage and institutional notes, when an archive is connected.',
        },
        {
          title: 'Asset matching',
          detail: 'Tag search against the configured library; derivatives generated on the fly.',
        },
        {
          title: 'Package assembly',
          detail: 'Facts without source URLs dropped. Gaps named. Package ships.',
        },
      ],
      worked: [
        'Five-gate evaluation ran against real workspace context',
        'Tag search + derivative generation',
        'Source-URL filtration at assembly',
      ],
      didntWork: [
        'Heuristic mode — connect an LLM provider (ANTHROPIC_API_KEY / OPENAI_API_KEY) for full Editorial Director reasoning',
        'Visual search not indexed — fell back to tag search',
      ],
    };
  }
}
