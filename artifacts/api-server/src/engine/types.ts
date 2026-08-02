// Composer Studio engine — domain types + adapter seam.
// Every capability in the engine is a pluggable adapter. Nothing is
// hardwired. Adapters report capabilities; the compose loop degrades
// gracefully and notes every gap honestly in the package.

export type RightsStatus = 'cleared' | 'expiring' | 'check' | 'unknown';
export type GateStatus = 'pass' | 'warn' | 'fail';
export type Verdict = 'APPROVED' | 'REVISE';
export type PackageKind = 'breaking' | 'feature' | 'general';
export type ArchiveDepth = 'shallow' | 'standard' | 'deep';
export type SendDestination = 'beehiiv' | 'cms' | 'download';
export type ScenarioKey = 'casa-soledad' | 'noto-earthquake' | 'general';

export const GATE_NAMES = [
  'Theme alignment',
  'Angle differentiation',
  'Audience need',
  'Production reality',
  'Calendar fit',
] as const;
export type GateName = (typeof GATE_NAMES)[number];

export interface ComposeInput {
  brief: string;
  platforms: string[];
  archiveDepth: ArchiveDepth;
}

export interface ParsedBrief {
  headline: string;
  subhead: string;
  kind: PackageKind;
  badge?: string;
  searchTags: string[];
  scenario: ScenarioKey;
}

export interface GateResult {
  gate: GateName;
  status: GateStatus;
  note: string;
}

export interface GateEvaluation {
  gates: GateResult[];
  verdict: Verdict;
  verdictSummary: string;
  requiredRevisions: string[];
  editorNote?: string;
}

export interface Derivative {
  key: 'hero' | 'social' | 'story' | 'thumb';
  label: string;
  width: number;
  height: number;
  url: string;
}

export interface MatchedAsset {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  tags: string[];
  matchNote?: string;
  photographer?: string;
  campaign?: string;
  rightsLabel?: string;
  rightsStatus: RightsStatus;
  rightsExpiresAt?: string;
  rightsNote?: string;
  derivatives: Derivative[];
}

export interface ArchiveFinding {
  title: string;
  excerpt: string;
  date?: string;
  source: string;
}

export interface MetricCard {
  label: string;
  value: string;
  sub?: string;
}

export interface ArchiveResult {
  connected: boolean;
  adapterName: string;
  findings: ArchiveFinding[];
  metrics: MetricCard[];
  note?: string;
}

export interface SourceFact {
  text: string;
  sourceName?: string;
  /** No URL, no fact. Facts without one are dropped at assembly. */
  sourceUrl?: string;
}

export interface CompetitorCard {
  name: string;
  detail: string;
  color: string;
  sourceUrl?: string;
}

export interface MarketContext {
  intro: string;
  competitors: CompetitorCard[];
  /** Filtered at assembly: every fact here is guaranteed to carry a sourceUrl. */
  facts: SourceFact[];
  droppedFactCount: number;
  callout?: string;
}

export interface Deliverable {
  title: string;
  detail: string;
  color: string;
}

export interface WorkflowStep {
  title: string;
  detail: string;
}

export type CapabilityTone = 'ok' | 'warn' | 'gap';
export interface CapabilityNote {
  area: 'search' | 'assets' | 'archive' | 'rights' | 'send' | 'model';
  tone: CapabilityTone;
  note: string;
}

export interface Provenance {
  worked: string[];
  didntWork: string[];
  capabilityNotes: CapabilityNote[];
  generationMs: number;
}

export interface ComposerPackage {
  id: string;
  orgId: string;
  createdAt: string;
  brief: string;
  platforms: string[];
  archiveDepth: ArchiveDepth;
  kind: PackageKind;
  badge?: string;
  headline: string;
  subhead: string;
  evaluation: GateEvaluation;
  assets: MatchedAsset[];
  assetSearchNote?: string;
  archive: ArchiveResult;
  market: MarketContext;
  deliverables: Deliverable[];
  workflow: WorkflowStep[];
  provenance: Provenance;
}

export interface MemoryEntry {
  id: string;
  packageId: string;
  topic: string;
  createdAt: string;
  lanesTaken: string[];
  rightsFlagged: string[];
  verdict: Verdict;
  platforms: string[];
}

export interface SendRecord {
  id: string;
  packageId: string;
  destination: SendDestination;
  status: 'draft-created' | 'download-ready' | 'skipped';
  url?: string;
  note: string;
  createdAt: string;
}

export interface WorkspaceContextData {
  activeThemes: string[];
  recentCoverage: string[];
  voiceNotes: string;
  calendar: string[];
}

export interface SearchAdapter {
  name: string;
  capabilities(): Promise<{ webSearch: boolean; provider?: string }>;
  searchMarketContext(parsed: ParsedBrief): Promise<{
    available: boolean;
    intro: string;
    competitors: CompetitorCard[];
    facts: SourceFact[];
    callout?: string;
    note?: string;
  }>;
}

export interface AssetAdapter {
  name: string;
  capabilities(): Promise<{
    tagSearch: boolean;
    visualSearch: boolean;
    derivatives: boolean;
    rightsMetadata: boolean;
  }>;
  searchAssets(parsed: ParsedBrief): Promise<MatchedAsset[]>;
  listAssets(): Promise<MatchedAsset[]>;
  buildDerivatives(asset: MatchedAsset): Derivative[];
}

export interface ArchiveAdapter {
  name: string;
  capabilities(): Promise<{ connected: boolean; deepSearch: boolean }>;
  searchArchive(parsed: ParsedBrief, depth: ArchiveDepth): Promise<ArchiveResult>;
}

export interface RightsAdapter {
  name: string;
  capabilities(): Promise<{ embeddedMetadata: boolean; expiryTracking: boolean }>;
  enrichRights(assets: MatchedAsset[]): Promise<MatchedAsset[]>;
}

export interface SendAdapter {
  name: string;
  capabilities(): Promise<{ beehiivDraft: boolean; cmsDraft: boolean; downloadAll: boolean }>;
  send(
    pkg: ComposerPackage,
    destination: SendDestination,
  ): Promise<Omit<SendRecord, 'id' | 'packageId' | 'createdAt'>>;
}

export interface ModelAdapter {
  name: string;
  capabilities(): Promise<{ gateEval: boolean; provider?: string }>;
  parseBrief(input: ComposeInput): Promise<ParsedBrief>;
  evaluateGates(args: {
    parsed: ParsedBrief;
    workspace: WorkspaceContextData;
  }): Promise<GateEvaluation>;
  packageContent(parsed: ParsedBrief): Promise<{
    deliverables: Deliverable[];
    workflow: WorkflowStep[];
    worked: string[];
    didntWork: string[];
    assetSearchNote?: string;
  }>;
}

export interface ComposerAdapters {
  webSearch: SearchAdapter;
  imageLibrary: AssetAdapter;
  archive: ArchiveAdapter;
  rights: RightsAdapter;
  send: SendAdapter;
  llm: ModelAdapter;
}

// ── Intake router + source-agnostic asset quick-hit ─────────

export type IntakeRoute = 'assets' | 'compose' | 'newsletter';

export interface IntakeClassification {
  route: IntakeRoute;
  reason: string;
  query?: string;
}

export type AssetSourceStatus = 'matched' | 'searched-empty' | 'not-connected';

export interface AssetSourceReport {
  source: string;
  status: AssetSourceStatus;
  matchCount: number;
  note: string;
}

export interface AssetSearchResult {
  query: string;
  total: number;
  assets: MatchedAsset[];
  sources: AssetSourceReport[];
}

export interface RightsCheckResult {
  assetId: string;
  found: boolean;
  source?: string;
  status?: RightsStatus;
  badge?: string;
  photographer?: string;
  rightsLabel?: string;
  expiresAt?: string;
  note: string;
}

// ── Newsletter batch workflow (v1.5) ─────────────────────────

export interface StoryAtom {
  index: number;
  title: string;
  dek?: string;
  body: string;
  searchQuery: string;
  wordCount: number;
}

export interface StoryPackage {
  atom: StoryAtom;
  assets: MatchedAsset[];
  sources: AssetSourceReport[];
  note?: string;
}

export interface HeroRecommendation {
  assetId: string;
  storyIndex: number;
  storyTitle: string;
  reasoning: string;
  asset: MatchedAsset;
}

export type AtomizationMethod = 'heuristic' | 'llm';

export interface EditionPackage {
  id: string;
  orgId: string;
  createdAt: string;
  title: string;
  storyCount: number;
  stories: StoryPackage[];
  hero: HeroRecommendation | null;
  heroNote?: string;
  atomization: AtomizationMethod;
  notes: string[];
  generationMs: number;
}
