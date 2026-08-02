import type { FixtureScenario } from './shared.js';
import { cloudinaryUrl } from './shared.js';

const CLOUD = 'dzubrbbnz';

export const NOTO_EARTHQUAKE: FixtureScenario = {
  key: 'noto-earthquake',
  parsed: {
    headline: '7.2 earthquake strikes Noto Peninsula, Japan',
    subhead: 'Tsunami warnings issued across Pacific Rim — same region devastated in Jan 2024',
    kind: 'breaking',
    badge: 'Breaking',
    searchTags: ['travel', 'japan', 'coastal', 'landscape'],
  },
  evaluation: {
    gates: [
      { gate: 'Theme alignment', status: 'warn', note: 'Breaking news — outside active themes by definition' },
      { gate: 'Angle differentiation', status: 'warn', note: 'Differentiation against wire coverage unclear' },
      { gate: 'Audience need', status: 'warn', note: 'Brief needs sharper audience targeting' },
      { gate: 'Production reality', status: 'pass', note: 'Scope realistic — assign to digital + social desks simultaneously' },
      { gate: 'Calendar fit', status: 'pass', note: 'Pre-empts scheduled coverage; news judgment applies' },
    ],
    verdict: 'REVISE',
    verdictSummary:
      'Brief needs sharper audience targeting. Angle differentiation against wire coverage unclear. Recommended: focus on the recovery-context angle — "a community still rebuilding gets hit again."',
    requiredRevisions: [
      'Name the target audience for the context package',
      'Lead with the recovery-context angle, not the magnitude',
      'Define what we add beyond wire coverage in one sentence',
    ],
    editorNote:
      "Without workspace context the gates come back mostly yellow — the engine can't check themes or recent coverage it doesn't have. Feed it real context and the critique sharpens.",
  },
  assets: [
    {
      id: 'noto-travel-1',
      url: cloudinaryUrl(CLOUD, 'pkmynm6hu7xqc9mkfrod.jpg', undefined, 'v1769154504'),
      thumbnailUrl: cloudinaryUrl(CLOUD, 'pkmynm6hu7xqc9mkfrod.jpg', 'c_fill,w_300,h_400', 'v1769154504'),
      width: 3730,
      height: 4662,
      format: 'jpg',
      bytes: 1_900_000,
      tags: ['travel', 'japan'],
      photographer: 'Archive — staff',
      rightsLabel: 'Perpetual · editorial',
      rightsStatus: 'cleared',
      derivatives: [],
    },
    {
      id: 'noto-travel-2',
      url: cloudinaryUrl(CLOUD, 'gu7txwoqma7epicwk9rv.jpg', undefined, 'v1769154503'),
      thumbnailUrl: cloudinaryUrl(CLOUD, 'gu7txwoqma7epicwk9rv.jpg', 'c_fill,w_300,h_400', 'v1769154503'),
      width: 4000,
      height: 6000,
      format: 'jpg',
      bytes: 2_700_000,
      tags: ['travel', 'coastal'],
      photographer: 'Archive — contributor',
      rightsLabel: 'Editorial use · credit required',
      rightsStatus: 'check',
      rightsNote: 'Contributor agreement requires byline credit on every use.',
      derivatives: [],
    },
    {
      id: 'noto-travel-3',
      url: cloudinaryUrl(CLOUD, 'zcea8ccse8hc2i4jfzyw.jpg', undefined, 'v1769154502'),
      thumbnailUrl: cloudinaryUrl(CLOUD, 'zcea8ccse8hc2i4jfzyw.jpg', 'c_fill,w_300,h_400', 'v1769154502'),
      width: 3835,
      height: 5753,
      format: 'jpg',
      bytes: 6_800_000,
      tags: ['travel', 'landscape'],
      rightsStatus: 'unknown',
      rightsNote: 'No rights metadata embedded — not on file.',
      derivatives: [],
    },
  ],
  assetSearchNote:
    'Library asset pull — 9 travel assets matched, showing top 3. Tag query: Travel. Visual search returned zero (indexing not enabled) — fell back to tag search.',
  archive: {
    connected: true,
    adapterName: 'mock-drive',
    findings: [
      {
        title: '2024 Noto earthquake — prior coverage',
        excerpt: 'On Jan 1, 2024, a M7.6 earthquake hit the same Noto Peninsula. 703 confirmed deaths. 204,903 structures damaged across nine prefectures.',
        date: '2024-01-01',
        source: 'drive://archive/2024/noto-earthquake',
      },
      {
        title: 'Recovery status — institutional notes',
        excerpt: 'The region had experienced an earthquake swarm since Dec 2020. Recovery was still ongoing as of late 2024 — 150,000 houses damaged, 6,445 completely destroyed.',
        date: '2024-11-15',
        source: 'drive://archive/2024/noto-recovery-notes',
      },
    ],
    metrics: [
      { label: '2024 fatalities', value: '703', sub: '228 direct + 475 disaster-related' },
      { label: 'Structures damaged', value: '204,903', sub: 'Across nine prefectures' },
    ],
  },
  marketIntro: 'Live context on the current quake — wire and agency reporting, with sources attached:',
  competitors: [],
  marketFacts: [
    { text: 'JMA issued tsunami warnings for the Noto coast within minutes of the M7.2 quake.', sourceName: 'jma.go.jp', sourceUrl: 'https://www.jma.go.jp/' },
    { text: 'USGS recorded the epicenter on the Noto Peninsula — the same fault system as the Jan 2024 M7.6 event.', sourceName: 'usgs.gov', sourceUrl: 'https://earthquake.usgs.gov/' },
    { text: 'NHK reports evacuation orders in the same municipalities still rebuilding from 2024.', sourceName: 'nhk.or.jp', sourceUrl: 'https://www3.nhk.or.jp/' },
    { text: 'Unconfirmed reports of damage to the Wajima morning market.' },
  ],
  marketCallout:
    'Every fact in this package carries a source URL. Anything that arrives without one is dropped at assembly — no URL, no fact.',
  deliverables: [
    { title: 'Digital article context block', detail: 'Pre-written sidebar: "What happened in 2024" — 150-word summary with key stats, timeline, recovery status.', color: '#534AB7' },
    { title: 'Social media kit', detail: '3 platform-ready posts (X/threads, Instagram story, LinkedIn). Each includes copy, suggested asset, and alt text.', color: '#1D9E75' },
    { title: 'Photo/video asset sheet', detail: '5 matched assets with usage rights, photographer credits, and pre-generated derivatives.', color: '#D85A30' },
    { title: 'Source + contact sheet', detail: 'Prior sources from 2024 coverage. Regional contacts. Wire service links. Background docs from the archive.', color: '#888780' },
  ],
  workflow: [
    { title: 'Editor triggers package', detail: "Single prompt: \"Earthquake, Noto Peninsula, context package.\" That's the entire input." },
    { title: 'Editorial Director evaluates brief', detail: 'Runs five-gate editorial assessment. Returns angle recommendation.' },
    { title: 'Archive search', detail: 'Queries the archive for prior coverage — surfaces context that would take a reporter 30 min to find manually.' },
    { title: 'Asset matching', detail: 'Visual search + tag query against the library. Returns matched assets with rights metadata.' },
    { title: 'Package assembly + delivery', detail: 'All components assembled. Everything editable, nothing locked.' },
  ],
  worked: [
    'Editorial Director (5-gate eval, voice, themes)',
    'Asset library (search, transform, deliver)',
    'Archive (prior coverage + institutional notes)',
    'Web search (live context with source URLs)',
    'Package assembly in under a minute',
  ],
  didntWork: [
    'Visual search indexing (not enabled on the library — fell back to tag search)',
    'One URL-less fact dropped at assembly (unverified market damage report)',
  ],
};
