import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isMockMode } from '../mock.js';
import { DEFAULT_WORKSPACE, FIXTURE_BRIEFS } from './fixtures/shared.js';
import type {
  ComposerPackage,
  EditionPackage,
  MemoryEntry,
  SendRecord,
  WorkspaceContextData,
} from './types.js';

type StoreData = {
  packages: ComposerPackage[];
  editions: EditionPackage[];
  memory: MemoryEntry[];
  sends: SendRecord[];
  workspaceByOrg: Record<string, WorkspaceContextData>;
};

const EMPTY: StoreData = {
  packages: [],
  editions: [],
  memory: [],
  sends: [],
  workspaceByOrg: {},
};

const DATA_FILE = path.join(process.cwd(), '.data', 'composer-store.json');

const globalStore = globalThis as unknown as {
  __composerStore?: StoreData;
  __composerSeed?: Promise<void>;
};

async function load(): Promise<StoreData> {
  if (globalStore.__composerStore) return globalStore.__composerStore;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    globalStore.__composerStore = { ...EMPTY, ...(JSON.parse(raw) as StoreData) };
  } catch {
    globalStore.__composerStore = { ...EMPTY };
  }
  return globalStore.__composerStore!;
}

async function persist(): Promise<void> {
  if (!globalStore.__composerStore) return;
  try {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(globalStore.__composerStore, null, 2));
  } catch {
    // best effort — read-only filesystems just stay in-memory
  }
}

// ── Packages ─────────────────────────────────────────────────

export async function listPackages(orgId?: string): Promise<ComposerPackage[]> {
  const store = await load();
  return store.packages
    .filter((p) => !orgId || p.orgId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPackage(id: string): Promise<ComposerPackage | null> {
  const store = await load();
  return store.packages.find((p) => p.id === id) ?? null;
}

export async function savePackage(pkg: ComposerPackage): Promise<void> {
  const store = await load();
  store.packages = [pkg, ...store.packages.filter((p) => p.id !== pkg.id)];
  await persist();
}

// ── Newsletter editions ───────────────────────────────────────

export async function saveEdition(edition: EditionPackage): Promise<void> {
  const store = await load();
  store.editions = [edition, ...store.editions.filter((e) => e.id !== edition.id)];
  await persist();
}

export async function getEdition(id: string): Promise<EditionPackage | null> {
  const store = await load();
  return store.editions.find((e) => e.id === id) ?? null;
}

export async function listEditions(orgId?: string): Promise<EditionPackage[]> {
  const store = await load();
  return store.editions
    .filter((e) => !orgId || e.orgId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Memory ───────────────────────────────────────────────────

export async function appendMemory(orgId: string, entry: MemoryEntry): Promise<void> {
  const store = await load();
  store.memory = [entry, ...store.memory.filter((m) => m.id !== entry.id)];
  await persist();
}

export async function listMemory(): Promise<MemoryEntry[]> {
  const store = await load();
  return [...store.memory].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Sends ────────────────────────────────────────────────────

export async function recordSend(record: SendRecord): Promise<void> {
  const store = await load();
  store.sends = [record, ...store.sends];
  await persist();
}

// ── Workspace context ─────────────────────────────────────────

export async function getWorkspaceContextData(orgId: string): Promise<WorkspaceContextData> {
  const store = await load();
  return store.workspaceByOrg[orgId] ?? DEFAULT_WORKSPACE;
}

// ── Seed (mock mode: fixture packages) ───────────────────────

export async function ensureSeedData(orgId: string): Promise<void> {
  if (!isMockMode()) return;
  if (!globalStore.__composerSeed) {
    globalStore.__composerSeed = (async () => {
      const store = await load();
      const missing = (Object.keys(FIXTURE_BRIEFS) as Array<keyof typeof FIXTURE_BRIEFS>).filter(
        (key) => !store.packages.some((p) => p.id === key),
      );
      if (missing.length === 0) return;
      const { composePackage } = await import('./compose.js');
      for (const key of missing) {
        await composePackage(
          {
            brief: FIXTURE_BRIEFS[key],
            platforms: key === 'noto-earthquake'
              ? ['Web article', 'X/Threads', 'Instagram', 'LinkedIn']
              : ['Newsletter', 'Instagram'],
            archiveDepth: key === 'noto-earthquake' ? 'deep' : 'standard',
          },
          orgId,
        );
      }
    })();
  }
  await globalStore.__composerSeed;
}
