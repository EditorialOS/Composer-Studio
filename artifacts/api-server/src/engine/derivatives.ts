import type { Derivative, MatchedAsset } from './types.js';

export const DERIVATIVE_SPECS: Array<Pick<Derivative, 'key' | 'label' | 'width' | 'height'>> = [
  { key: 'hero', label: 'Hero 16:9', width: 1920, height: 1080 },
  { key: 'social', label: 'Social square', width: 1080, height: 1080 },
  { key: 'story', label: 'Story 9:16', width: 1080, height: 1920 },
  { key: 'thumb', label: 'Thumbnail', width: 400, height: 300 },
];

/** Insert a Cloudinary transform into a delivery URL (after `/upload/`). */
export function cloudinaryTransform(url: string, transform: string): string {
  const marker = '/image/upload/';
  const idx = url.indexOf(marker);
  if (idx === -1) return url;
  const head = url.slice(0, idx + marker.length);
  const tail = url.slice(idx + marker.length);
  const cleaned = tail.replace(/^([a-z0-9_,=.:]+\/)+(?=v?\d*\/|[^/]+$)/, '');
  return `${head}${transform}/${cleaned}`;
}

export function buildDerivatives(asset: MatchedAsset): Derivative[] {
  return DERIVATIVE_SPECS.map((spec) => ({
    ...spec,
    label: `${spec.label} (${spec.width}×${spec.height})`,
    url: cloudinaryTransform(
      asset.url,
      `c_fill,w_${spec.width},h_${spec.height},g_auto,f_auto,q_auto`,
    ),
  }));
}

export function withDerivatives(asset: MatchedAsset): MatchedAsset {
  return { ...asset, derivatives: buildDerivatives(asset) };
}
