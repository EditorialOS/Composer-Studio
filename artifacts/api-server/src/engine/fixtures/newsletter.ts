import type { MatchedAsset } from '../types.js';
import { cloudinaryUrl } from './shared.js';

export const NEWSLETTER_DEMO_EDITION = `# The Departures — Issue 42
Three stories for the week: a Oaxaca opening worth the flight, 48 hours in Tokyo, and why mezcal is having its natural-wine moment.

## Casa Soledad opens in Oaxaca
Casa Soledad, a 12-room boutique hotel in Oaxaca's centro histórico, opens its doors timed to Day of the Dead. Rooftop mezcal bar, pre-Hispanic tasting menu, courtyard rooms around a 200-year-old jacaranda. Rates from $380. The hotel joins a wave of design-forward openings along the Oaxacan coast and capital, and the chef's tasting menu leans on heirloom corn and mole negro from the Sierra Norte.

## 48 hours in Tokyo
Our Tokyo city guide: where to stay, eat, and wander for a tight two days. Base yourself in Nakameguro for canal-side coffee, book the counter at a six-seat yakitori spot in Shibuya, and save one evening for Shinjuku's neon alleys. Transit is simpler than it looks — one Suica card covers everything. Fall foliage hits the city parks in late November, and the skyline from Shibuya Sky at dusk is the single best view in the city.

## Mezcal's natural-wine moment
Mezcal is having its natural-wine moment: small-batch, single-village agave spirits are crossing over from specialist bars to mainstream lists. We look at the palenques leading the charge in Oaxaca, the agave scarcity behind the price creep, and what to order if you only know smoke. Espadín is the gateway; tepeztate and tobalá are where it gets interesting — and expensive.
`;

export const NEWSLETTER_DEMO_TITLES = [
  'Casa Soledad opens in Oaxaca',
  '48 hours in Tokyo',
  "Mezcal's natural-wine moment",
];

function baseAsset(
  partial: Partial<MatchedAsset> & Pick<MatchedAsset, 'id' | 'url' | 'tags'>,
): MatchedAsset {
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

export const NEWSLETTER_ASSETS: MatchedAsset[] = [
  // Story 1 — Casa Soledad / Oaxaca
  baseAsset({
    id: 'lib-oaxaca-rooftop-dusk',
    url: cloudinaryUrl('demo', 'samples/landscapes/beach-boat.jpg'),
    width: 1600,
    height: 1067,
    format: 'jpg',
    bytes: 412_000,
    tags: ['oaxaca', 'hotel', 'rooftop', 'mezcal', 'courtyard'],
    photographer: 'Amisha Gurbani',
    campaign: 'Casa Soledad launch',
    rightsLabel: 'Perpetual · all channels',
    rightsStatus: 'cleared',
  }),
  baseAsset({
    id: 'lib-oaxaca-tasting-menu',
    url: cloudinaryUrl('demo', 'samples/food/pot-mussels.jpg'),
    width: 1200,
    height: 800,
    format: 'jpg',
    bytes: 288_000,
    tags: ['oaxaca', 'hotel', 'tasting', 'menu', 'chef', 'dining'],
    photographer: 'Wire syndication',
    rightsLabel: 'One-time print use — web unclear',
    rightsStatus: 'check',
    rightsNote: 'Syndication terms ambiguous for digital; confirm before publish.',
  }),
  // Story 2 — Tokyo city guide
  baseAsset({
    id: 'lib-tokyo-skyline-dusk',
    url: cloudinaryUrl('demo', 'samples/landscapes/architecture-signs.jpg'),
    width: 2400,
    height: 1350,
    format: 'jpg',
    bytes: 864_000,
    tags: ['tokyo', 'skyline', 'city', 'dusk', 'shibuya'],
    photographer: 'Maren Koto',
    campaign: 'City Guides 2026',
    rightsLabel: 'Perpetual · all channels',
    rightsStatus: 'cleared',
  }),
  baseAsset({
    id: 'lib-tokyo-alley-night',
    url: cloudinaryUrl('demo', 'samples/ecommerce/accessories-bag.jpg'),
    width: 1080,
    height: 1350,
    format: 'jpg',
    bytes: 198_000,
    tags: ['tokyo', 'alley', 'night', 'neon', 'street'],
    rightsStatus: 'unknown',
    rightsNote: 'No embedded XMP/IPTC rights metadata — not on file.',
  }),
  // Story 3 — Mezcal trend piece
  baseAsset({
    id: 'lib-mezcal-copal-pour',
    url: cloudinaryUrl('demo', 'samples/food/spices.jpg'),
    width: 1400,
    height: 933,
    format: 'jpg',
    bytes: 332_000,
    tags: ['mezcal', 'agave', 'bar', 'pour', 'spirits'],
    photographer: 'In-house studio',
    campaign: 'Drinks vertical',
    rightsLabel: 'Editorial use · expires soon',
    rightsStatus: 'expiring',
    rightsExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 18).toISOString(),
    rightsNote: 'License expires within 30 days — re-clear before the next drinks feature.',
  }),
  baseAsset({
    id: 'lib-mezcal-agave-field',
    url: cloudinaryUrl('demo', 'samples/landscapes/nature-mountains.jpg'),
    width: 2000,
    height: 1125,
    format: 'jpg',
    bytes: 540_000,
    tags: ['mezcal', 'agave', 'oaxaca', 'palenque', 'field'],
    photographer: 'Maren Koto',
    campaign: 'Drinks vertical',
    rightsLabel: 'Perpetual · all channels',
    rightsStatus: 'cleared',
  }),
];
