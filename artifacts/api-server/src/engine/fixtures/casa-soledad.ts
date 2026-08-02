import type { FixtureScenario } from './shared.js';
import { cloudinaryUrl } from './shared.js';

const CLOUD = 'dzubrbbnz';

export const CASA_SOLEDAD: FixtureScenario = {
  key: 'casa-soledad',
  parsed: {
    headline: 'Casa Soledad — Oaxaca boutique hotel opening',
    subhead:
      '12 rooms · rooftop mezcal bar · pre-Hispanic tasting menu · Day of the Dead launch timing',
    kind: 'feature',
    searchTags: ['food', 'oaxaca', 'hotel', 'restaurant', 'dining', 'chef'],
  },
  evaluation: {
    gates: [
      { gate: 'Theme alignment', status: 'fail', note: 'Does not clearly advance active themes' },
      { gate: 'Angle differentiation', status: 'pass', note: 'Distinct from Merida feature + Mexico City guide' },
      { gate: 'Audience need', status: 'warn', note: 'Link exists but thesis not sharp enough' },
      { gate: 'Production reality', status: 'pass', note: 'Scope realistic for current capacity' },
      { gate: 'Calendar fit', status: 'warn', note: 'Day of the Dead timing competes with holiday coverage' },
    ],
    verdict: 'REVISE',
    verdictSummary:
      "The red flag on theme alignment is real editorial pushback. The workspace lists \"design-forward hospitality\" and \"chef-driven dining\" as active themes, but the story brief doesn't connect explicitly to either. A human editor would say the same thing: \"Why are we covering this hotel specifically? What's the thesis?\"",
    requiredRevisions: [
      'Clarify the unique thesis in one sentence',
      'Remove overlap with recent coverage and name what is new',
      'Tie delivery scope to current production capacity',
    ],
    editorNote:
      'Compare to a brief run without workspace context: it got mostly yellows because the engine had no themes or recent coverage to check against. With real context, the critique is harder and more specific.',
  },
  assets: [
    {
      id: 'casa-food-hero',
      url: cloudinaryUrl(CLOUD, 'txsvfxez4ec7cjojguzu.png', undefined, 'v1769122586'),
      thumbnailUrl: cloudinaryUrl(CLOUD, 'txsvfxez4ec7cjojguzu.png', 'c_fill,w_400,h_400,g_auto', 'v1769122586'),
      width: 400,
      height: 400,
      format: 'png',
      bytes: 1_048_576,
      tags: ['food'],
      matchNote: 'Tag match: food — the only food-tagged asset in the library.',
      photographer: 'Amisha Gurbani',
      campaign: 'St Chronicle',
      rightsLabel: '1 year · Campaign: St Chronicle',
      rightsStatus: 'expiring',
      rightsExpiresAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
      rightsNote: 'Usage rights expire — flagged automatically from metadata.',
      derivatives: [],
    },
  ],
  assetSearchNote:
    'Visual search for "food restaurant dining chef" returned zero results — tag-based search worked and surfaced the food asset below.',
  archive: {
    connected: false,
    adapterName: 'none',
    findings: [],
    metrics: [],
    note: 'No archive configured — the institutional-knowledge layer is empty.',
  },
  marketIntro: "Oaxaca's hotel scene is accelerating. Live market research surfaced these recent openings:",
  competitors: [
    { name: 'Kymaia', detail: '22 suites, pre-Hispanic pyramid design, regenerative gardens. By the Casona Sforza founder.', color: '#534AB7', sourceUrl: 'https://www.kymaia.com/' },
    { name: 'Casa Yatí', detail: '8 rooms, oceanfront Ventanilla, Padre Studio design. Opened mid-2025.', color: '#1D9E75', sourceUrl: 'https://www.casayati.com/' },
    { name: 'Xiqué Boutique Hotel', detail: '8 rooms, Puerto Escondido, pink chukum + clay tiles. Estudio Carroll.', color: '#D85A30', sourceUrl: 'https://xiquehotel.com/' },
    { name: 'Hotel Humano', detail: '39 rooms, La Punta Zicatela, Grupo Habita portfolio. Surfer-shack aesthetic.', color: '#888780', sourceUrl: 'https://grupohabita.mx/hotels/humano/' },
  ],
  marketFacts: [
    { text: 'Kymaia opened on the Oaxacan coast with 22 suites and regenerative gardens.', sourceName: 'kymaia.com', sourceUrl: 'https://www.kymaia.com/' },
    { text: 'Casa Yatí opened mid-2025 in Ventanilla with 8 oceanfront rooms designed by Padre Studio.', sourceName: 'casayati.com', sourceUrl: 'https://www.casayati.com/' },
    { text: 'Grupo Habita added Hotel Humano (39 rooms) to its La Punta Zicatela portfolio.', sourceName: 'grupohabita.mx', sourceUrl: 'https://grupohabita.mx/hotels/humano/' },
    { text: 'A fifth unverified opening is rumored for late this season.' },
  ],
  marketCallout:
    "This is where the composer adds value the editor doesn't have time for. Before writing a word about Casa Soledad, you now know the competitive set.",
  deliverables: [
    { title: 'Newsletter feature block', detail: 'Pre-written 200-word feature section: thesis-forward lede, competitive-set positioning, tasting-menu detail.', color: '#534AB7' },
    { title: 'Social media kit', detail: '3 platform-ready posts (Instagram, X/Threads, LinkedIn) with copy, suggested asset + crop, and alt text.', color: '#1D9E75' },
    { title: 'Photo asset sheet', detail: 'Matched asset with photographer credit, usage rights + expiry flag, and pre-generated derivatives.', color: '#D85A30' },
    { title: 'Competitive set card', detail: 'The four recent Oaxaca openings with designer, room count, and angle.', color: '#888780' },
  ],
  workflow: [
    { title: 'Editor triggers package', detail: "Single brief: the hotel, the hook, the timing. That's the entire input." },
    { title: 'Editorial Director evaluates brief', detail: 'Runs the five-gate assessment against active themes, recent coverage, voice standards, and the calendar. Returns REVISE.' },
    { title: 'Archive search', detail: 'No archive is connected — the package says so honestly instead of failing silently.' },
    { title: 'Asset matching', detail: 'Tag search against the library. Returns the food asset with rights metadata; generates derivatives on the fly.' },
    { title: 'Market context + assembly', detail: 'Live web research surfaces the four competitive openings. Facts without a source URL are dropped at assembly.' },
  ],
  worked: [
    'Editorial Director gave a harder, more specific critique — the red on theme alignment is a real editorial call.',
    'The library returned a food-tagged asset with real photographer credits, usage rights, and expiration metadata.',
    'Live derivative generation produced a publishable 1080×1080 social crop via c_fill,w_1080,h_1080,g_auto.',
    'Market research surfaced 4 recent Oaxaca hotel openings with design details.',
  ],
  didntWork: [
    'Visual search returned zero — assets need visual_search indexing enabled on upload. Fell back to tag search.',
    'No archive connected — the institutional-knowledge layer is empty.',
    'One market-context fact arrived without a source URL and was dropped at assembly (no URL, no fact).',
  ],
};
