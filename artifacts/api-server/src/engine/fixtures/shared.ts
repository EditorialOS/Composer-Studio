import type {
  ArchiveResult,
  ComposerPackage,
  CompetitorCard,
  Deliverable,
  GateEvaluation,
  MatchedAsset,
  ParsedBrief,
  ScenarioKey,
  SourceFact,
  WorkflowStep,
  WorkspaceContextData,
} from '../types.js';

export interface FixtureScenario {
  key: ScenarioKey;
  parsed: Omit<ParsedBrief, 'scenario'>;
  evaluation: GateEvaluation;
  assets: MatchedAsset[];
  assetSearchNote?: string;
  archive: ArchiveResult;
  marketIntro: string;
  competitors: CompetitorCard[];
  marketFacts: SourceFact[];
  marketCallout?: string;
  deliverables: Deliverable[];
  workflow: WorkflowStep[];
  worked: string[];
  didntWork: string[];
}

// Satisfy TS — ComposerPackage referenced transitively
export type { ComposerPackage };

export const DEFAULT_WORKSPACE: WorkspaceContextData = {
  activeThemes: ['design-forward hospitality', 'chef-driven dining'],
  recentCoverage: [
    'Mérida feature: colonial architecture and the new design-hotel wave',
    'Mexico City guide: chef-led tasting menus beyond Pujol',
  ],
  voiceNotes:
    'Direct, unsentimental, design-literate. Lead with what is new; name the competitive set; no travel-brochure adjectives.',
  calendar: [
    'Day of the Dead coverage block (Oct 28 – Nov 3)',
    'Holiday gift guide — first draft due',
  ],
};

export function cloudinaryUrl(
  cloud: string,
  publicId: string,
  transform?: string,
  version?: string,
): string {
  const t = transform ? `${transform}/` : '';
  const v = version ? `${version}/` : '';
  return `https://res.cloudinary.com/${cloud}/image/upload/${t}${v}${publicId}`;
}

function baseAsset(partial: Partial<MatchedAsset> & Pick<MatchedAsset, 'id' | 'url' | 'tags'>): MatchedAsset {
  return {
    thumbnailUrl: partial.url,
    width: 0,
    height: 0,
    format: 'jpg',
    bytes: 0,
    rightsStatus: 'unknown',
    derivatives: [],
    ...partial,
  };
}

export const LIBRARY_EXTRAS: MatchedAsset[] = [
  baseAsset({
    id: 'lib-apple-orchard-row',
    url: cloudinaryUrl('demo', 'samples/food/pot-mussels.jpg'),
    width: 864,
    height: 576,
    format: 'jpg',
    bytes: 132_000,
    tags: ['apple', 'orchard', 'harvest', 'fruit'],
    photographer: 'Maren Koto',
    campaign: 'Harvest 2026',
    rightsLabel: 'Perpetual · all channels',
    rightsStatus: 'cleared',
  }),
  baseAsset({
    id: 'lib-apple-crate-closeup',
    url: cloudinaryUrl('demo', 'samples/food/spices.jpg'),
    width: 864,
    height: 576,
    format: 'jpg',
    bytes: 118_000,
    tags: ['apple', 'crate', 'market', 'fruit'],
    photographer: 'Maren Koto',
    campaign: 'Harvest 2026',
    rightsLabel: 'Editorial use · expires soon',
    rightsStatus: 'expiring',
    rightsExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 21).toISOString(),
    rightsNote: 'License expires within 30 days — re-clear before the fall campaign.',
  }),
  baseAsset({
    id: 'lib-apple-blossom-spring',
    url: cloudinaryUrl('demo', 'samples/landscapes/beach-boat.jpg'),
    width: 864,
    height: 576,
    format: 'jpg',
    bytes: 96_000,
    tags: ['apple', 'blossom', 'orchard', 'spring'],
    rightsStatus: 'unknown',
    rightsNote: 'No embedded XMP/IPTC rights metadata — not on file.',
  }),
  baseAsset({
    id: 'lib-evergreen-terrace',
    url: cloudinaryUrl('demo', 'sample.jpg'),
    width: 864,
    height: 576,
    format: 'jpg',
    bytes: 89_000,
    tags: ['terrace', 'evergreen', 'lifestyle'],
    photographer: 'In-house studio',
    campaign: 'Evergreen',
    rightsLabel: 'Perpetual · all channels',
    rightsStatus: 'cleared',
  }),
  baseAsset({
    id: 'lib-market-spices',
    url: cloudinaryUrl('demo', 'samples/food/spices.jpg'),
    width: 864,
    height: 576,
    format: 'jpg',
    bytes: 120_000,
    tags: ['food', 'market', 'color'],
    photographer: 'Wire syndication',
    rightsLabel: 'One-time print use — web unclear',
    rightsStatus: 'check',
    rightsNote: 'Syndication terms ambiguous for digital; confirm before publish.',
  }),
  baseAsset({
    id: 'lib-coast-boat',
    url: cloudinaryUrl('demo', 'samples/landscapes/beach-boat.jpg'),
    width: 864,
    height: 576,
    format: 'jpg',
    bytes: 140_000,
    tags: ['coast', 'travel'],
    rightsStatus: 'unknown',
    rightsNote: 'No embedded XMP/IPTC rights metadata — not on file.',
  }),
];

export type FixturePackageSeed = Pick<MatchedAsset, 'id'>;

export const FIXTURE_BRIEFS = {
  'casa-soledad':
    'Casa Soledad — Oaxaca boutique hotel opening. 12 rooms, rooftop mezcal bar, pre-Hispanic tasting menu, Day of the Dead launch timing. Need: newsletter feature + social kit.',
  'noto-earthquake':
    'Earthquake, Noto Peninsula, context package. M7.2, tsunami warnings across the Pacific Rim — same region devastated in Jan 2024.',
} as const;

export const DRIVE_FILENAMES: string[] = [
  'IMG_2041.jpg',
  'IMG_2042.jpg',
  'oaxaca-rooftop-bar.jpg',
  'noto-aerial-damage.jpg',
  'spices-market-01.jpg',
  'terrace-evergreen-hero.jpg',
];
