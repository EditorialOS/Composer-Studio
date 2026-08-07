// The newsletter batch workflow (v1.5): paste a full edition →
// decompose into story atoms → per-story asset packages → ONE hero
// recommendation for the edition.

import { isMockMode } from '../mock.js';
import type { WorkspaceKeys } from './adapters/keys.js';
import { searchAllAssetSources } from './assets.js';
import { appendMemory, getEdition, saveEdition } from './store.js';
import type {
  AtomizationMethod,
  EditionPackage,
  HeroRecommendation,
  MatchedAsset,
  StoryAtom,
  StoryPackage,
} from './types.js';

const RUN_PREFIX = /^\s*\/run\s+newsletter\b[\s:.-]*/i;

export function stripRunPrefix(text: string): string {
  return text.replace(RUN_PREFIX, '').trim();
}

const HEADING = /^(#{1,3})\s+(.+?)\s*#*\s*$/;
const HR = /^\s*(?:---|\*\*\*|___)\s*$/;
const SUBJECT = /^(?:subject|story|headline)\s*:\s*(.+)$/i;

function atomFromSection(index: number, title: string, body: string): StoryAtom {
  const trimmedBody = body.trim();
  const words = trimmedBody.split(/\s+/).filter(Boolean);
  const searchQuery = `${title} ${words.slice(0, 30).join(' ')}`.trim();
  return {
    index,
    title: title.trim(),
    dek: words.slice(0, 24).join(' ') + (words.length > 24 ? '…' : ''),
    body: trimmedBody,
    searchQuery,
    wordCount: words.length,
  };
}

export function atomizeHeuristic(editionText: string): { title: string; stories: StoryAtom[] } {
  const text = stripRunPrefix(editionText);
  const lines = text.split('\n');

  let editionTitle = '';
  const sections: Array<{ title: string; level: number; body: string[] }> = [];

  for (const line of lines) {
    const heading = HEADING.exec(line);
    const subject = SUBJECT.exec(line);
    if (heading) {
      const [, hashes, title] = heading;
      if (hashes!.length === 1 && sections.length === 0 && !editionTitle) {
        editionTitle = title!;
        continue;
      }
      sections.push({ title: title!, level: hashes!.length, body: [] });
    } else if (subject) {
      sections.push({ title: subject[1]!, level: 2, body: [] });
    } else if (HR.test(line)) {
      const current = sections[sections.length - 1];
      if (current && current.body.join(' ').trim()) {
        sections.push({ title: '', level: 2, body: [] });
      }
    } else if (sections.length > 0) {
      sections[sections.length - 1]!.body.push(line);
    } else if (!editionTitle && line.trim()) {
      editionTitle = line.trim().slice(0, 90);
    }
  }

  const stories = sections
    .filter((s) => s.title || s.body.join(' ').trim())
    .map((s, i) => atomFromSection(i, s.title || `Story ${i + 1}`, s.body.join('\n')));

  if (!editionTitle) {
    editionTitle = stories[0]?.title ?? 'Untitled edition';
  }
  return { title: editionTitle, stories };
}

const MAX_DIMENSION = 4000;

function rankCleared(
  candidates: Array<{ asset: MatchedAsset; storyIndex: number; storyTitle: string }>,
): { asset: MatchedAsset; storyIndex: number; storyTitle: string } {
  return candidates.sort((a, b) => {
    const effA = Math.min(a.asset.width, MAX_DIMENSION) * Math.min(a.asset.height, MAX_DIMENSION);
    const effB = Math.min(b.asset.width, MAX_DIMENSION) * Math.min(b.asset.height, MAX_DIMENSION);
    if (effA !== effB) return effB - effA;
    if (a.storyIndex !== b.storyIndex) return a.storyIndex - b.storyIndex;
    return b.asset.width * b.asset.height - a.asset.width * a.asset.height;
  })[0]!;
}

function pickHero(stories: StoryPackage[]): { hero: HeroRecommendation | null; note?: string } {
  const all = stories.flatMap((story) =>
    story.assets.map((asset) => ({ asset, storyIndex: story.atom.index, storyTitle: story.atom.title })),
  );
  const cleared = all.filter((c) => c.asset.rightsStatus === 'cleared');

  if (cleared.length === 0) {
    const flagged = all.length;
    return {
      hero: null,
      note: flagged > 0
        ? `No CLEARED-rights asset across the ${stories.length} stories (${flagged} matched but flagged EXPIRING/CHECK/UNKNOWN) — hero recommendation withheld. Clear rights on one of the flagged assets and re-run.`
        : 'No assets matched any story in this edition — no hero recommendation possible.',
    };
  }

  const winner = rankCleared(cleared);
  const { asset } = winner;
  const others = cleared.length - 1;
  return {
    hero: {
      assetId: asset.id,
      storyIndex: winner.storyIndex,
      storyTitle: winner.storyTitle,
      reasoning:
        `"${asset.id}" is the strongest cleared-rights asset in the edition: ` +
        `${asset.rightsLabel ? `rights "${asset.rightsLabel}"` : 'rights CLEARED'}` +
        `${asset.photographer ? ` by ${asset.photographer}` : ''}, ` +
        `${asset.width}×${asset.height}px — highest-resolution CLEARED image across all ` +
        `${stories.length} stories${others > 0 ? ` (${others} other cleared candidate${others > 1 ? 's' : ''} considered)` : ''}. ` +
        `Comes from story ${winner.storyIndex + 1} ("${winner.storyTitle}"). ` +
        `EXPIRING, CHECK, and UNKNOWN assets were excluded on rights grounds.`,
      asset,
    },
  };
}

function slugify(text: string): string {
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
  return slug || 'edition';
}

async function uniqueEditionId(base: string): Promise<string> {
  if (!(await getEdition(base))) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!(await getEdition(candidate))) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function composeNewsletter(
  edition: string,
  orgId: string,
  keys?: WorkspaceKeys,
): Promise<EditionPackage> {
  const startedAt = Date.now();
  const text = edition.trim();
  const notes: string[] = [];

  let atomization: AtomizationMethod = 'heuristic';
  let { title, stories: atoms } = atomizeHeuristic(text);

  // LLM atomizer seam — heuristic only for now (mock mode); real mode
  // would call the model adapter here when configured.
  if (!isMockMode()) {
    notes.push('Model provider unavailable or unconfigured — edition atomized with the heading/HR heuristic.');
  } else {
    notes.push('Mock mode: edition atomized with the heading/HR heuristic.');
  }

  if (atoms.length === 0) {
    atoms = [atomFromSection(0, title || 'Untitled story', text)];
    notes.push('No story structure detected — treated the whole paste as a single story.');
  }

  const stories: StoryPackage[] = await Promise.all(
    atoms.map(async (atom) => {
      const result = await searchAllAssetSources(atom.searchQuery, keys);
      const ranked = [...result.assets].sort((a, b) => {
        const rank = (s: string) => (s === 'cleared' ? 0 : s === 'expiring' ? 1 : s === 'check' ? 2 : 3);
        const d = rank(a.rightsStatus) - rank(b.rightsStatus);
        return d !== 0 ? d : b.width * b.height - a.width * a.height;
      });
      const assets = ranked.slice(0, 6);
      const note =
        assets.length === 0
          ? 'No assets matched this story — treat as a shot spec and commission or clear imagery.'
          : assets.every((a) => a.rightsStatus !== 'cleared')
            ? 'Assets matched but none are CLEARED — rights work needed before publish.'
            : undefined;
      return { atom, assets, sources: result.sources, note };
    }),
  );

  const { hero, note: heroNote } = pickHero(stories);
  if (heroNote) notes.push(heroNote);

  const unknownRights = stories.flatMap((s) => s.assets).filter((a) => a.rightsStatus === 'unknown').length;
  if (unknownRights > 0) {
    notes.push(`${unknownRights} matched asset${unknownRights > 1 ? 's' : ''} with no rights metadata on file — flagged UNKNOWN.`);
  }
  const thinStories = stories.filter((s) => s.assets.length === 0).length;
  if (thinStories > 0) {
    notes.push(`${thinStories} stor${thinStories > 1 ? 'ies' : 'y'} with zero asset matches — shot spec needed.`);
  }

  const editionTitle = title || 'Untitled edition';
  const id = await uniqueEditionId(`edition-${slugify(editionTitle)}`);

  const pkg: EditionPackage = {
    id,
    orgId,
    createdAt: new Date().toISOString(),
    title: editionTitle,
    storyCount: stories.length,
    stories,
    hero,
    heroNote,
    atomization,
    notes,
    generationMs: Date.now() - startedAt,
  };

  await saveEdition(pkg);

  const rightsFlagged = [
    ...new Set(
      stories
        .flatMap((s) => s.assets)
        .filter((a) => a.rightsStatus !== 'cleared')
        .map((a) => `${a.photographer ?? a.id}: ${a.rightsStatus.toUpperCase()}`),
    ),
  ];

  await appendMemory(orgId, {
    id: `mem-${id}`,
    packageId: id,
    topic: `${editionTitle} (newsletter batch · ${stories.length} stories)`,
    createdAt: pkg.createdAt,
    lanesTaken: [
      'newsletter-batch',
      'assets',
      ...(rightsFlagged.length > 0 ? ['rights-flagged'] : ['rights']),
      ...(hero ? ['hero-recommendation'] : []),
    ],
    rightsFlagged,
    verdict: hero && stories.every((s) => s.assets.some((a) => a.rightsStatus === 'cleared')) ? 'APPROVED' : 'REVISE',
    platforms: ['Newsletter'],
  });

  return pkg;
}
