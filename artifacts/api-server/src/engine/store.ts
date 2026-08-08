import { promises as fs } from 'node:fs';
import path from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { isMockMode } from '../mock.js';
import { DEFAULT_WORKSPACE, FIXTURE_BRIEFS } from './fixtures/shared.js';
import type {
  ComposerPackage,
  EditionPackage,
  MemoryEntry,
  SendRecord,
  WorkspaceContextData,
} from './types.js';

// ── Backend selection ────────────────────────────────────────
// Real mode + DATABASE_URL → durable Postgres (@workspace/db).
// Everything else (mock mode, or real mode with no DB provisioned) →
// the in-memory/file store below, which degrades honestly: on serverless
// filesystems it simply stays in-memory for the instance's lifetime.

function pgEnabled(): boolean {
  return !isMockMode() && Boolean(process.env['DATABASE_URL']);
}

// The DB module throws at import time if DATABASE_URL is unset, so it is
// imported lazily — only when a database is actually configured.
type DbModule = typeof import('@workspace/db');
let dbModPromise: Promise<DbModule> | null = null;
function loadDb(): Promise<DbModule> {
  return (dbModPromise ??= import('@workspace/db'));
}

// ── In-memory / file fallback ────────────────────────────────

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
  if (pgEnabled()) {
    const { db, composerPackages } = await loadDb();
    const rows = orgId
      ? await db
          .select()
          .from(composerPackages)
          .where(eq(composerPackages.orgId, orgId))
          .orderBy(desc(composerPackages.createdAt))
      : await db.select().from(composerPackages).orderBy(desc(composerPackages.createdAt));
    return rows.map((r) => r.data as ComposerPackage);
  }
  const store = await load();
  return store.packages
    .filter((p) => !orgId || p.orgId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPackage(id: string): Promise<ComposerPackage | null> {
  if (pgEnabled()) {
    const { db, composerPackages } = await loadDb();
    const [row] = await db.select().from(composerPackages).where(eq(composerPackages.id, id)).limit(1);
    return row ? (row.data as ComposerPackage) : null;
  }
  const store = await load();
  return store.packages.find((p) => p.id === id) ?? null;
}

export async function savePackage(pkg: ComposerPackage): Promise<void> {
  if (pgEnabled()) {
    const { db, composerPackages } = await loadDb();
    const row = { id: pkg.id, orgId: pkg.orgId, createdAt: new Date(pkg.createdAt), data: pkg };
    await db
      .insert(composerPackages)
      .values(row)
      .onConflictDoUpdate({
        target: composerPackages.id,
        set: { orgId: row.orgId, createdAt: row.createdAt, data: row.data },
      });
    return;
  }
  const store = await load();
  store.packages = [pkg, ...store.packages.filter((p) => p.id !== pkg.id)];
  await persist();
}

// ── Newsletter editions ───────────────────────────────────────

export async function saveEdition(edition: EditionPackage): Promise<void> {
  if (pgEnabled()) {
    const { db, composerEditions } = await loadDb();
    const row = { id: edition.id, orgId: edition.orgId, createdAt: new Date(edition.createdAt), data: edition };
    await db
      .insert(composerEditions)
      .values(row)
      .onConflictDoUpdate({
        target: composerEditions.id,
        set: { orgId: row.orgId, createdAt: row.createdAt, data: row.data },
      });
    return;
  }
  const store = await load();
  store.editions = [edition, ...store.editions.filter((e) => e.id !== edition.id)];
  await persist();
}

export async function getEdition(id: string): Promise<EditionPackage | null> {
  if (pgEnabled()) {
    const { db, composerEditions } = await loadDb();
    const [row] = await db.select().from(composerEditions).where(eq(composerEditions.id, id)).limit(1);
    return row ? (row.data as EditionPackage) : null;
  }
  const store = await load();
  return store.editions.find((e) => e.id === id) ?? null;
}

export async function listEditions(orgId?: string): Promise<EditionPackage[]> {
  if (pgEnabled()) {
    const { db, composerEditions } = await loadDb();
    const rows = orgId
      ? await db
          .select()
          .from(composerEditions)
          .where(eq(composerEditions.orgId, orgId))
          .orderBy(desc(composerEditions.createdAt))
      : await db.select().from(composerEditions).orderBy(desc(composerEditions.createdAt));
    return rows.map((r) => r.data as EditionPackage);
  }
  const store = await load();
  return store.editions
    .filter((e) => !orgId || e.orgId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Memory ───────────────────────────────────────────────────

export async function appendMemory(orgId: string, entry: MemoryEntry): Promise<void> {
  if (pgEnabled()) {
    const { db, composerMemory } = await loadDb();
    const row = { id: entry.id, orgId, createdAt: new Date(entry.createdAt), data: entry };
    await db
      .insert(composerMemory)
      .values(row)
      .onConflictDoUpdate({
        target: composerMemory.id,
        set: { orgId: row.orgId, createdAt: row.createdAt, data: row.data },
      });
    return;
  }
  const store = await load();
  store.memory = [entry, ...store.memory.filter((m) => m.id !== entry.id)];
  await persist();
}

export async function listMemory(): Promise<MemoryEntry[]> {
  if (pgEnabled()) {
    const { db, composerMemory } = await loadDb();
    const rows = await db.select().from(composerMemory).orderBy(desc(composerMemory.createdAt));
    return rows.map((r) => r.data as MemoryEntry);
  }
  const store = await load();
  return [...store.memory].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── Sends ────────────────────────────────────────────────────

export async function recordSend(record: SendRecord): Promise<void> {
  if (pgEnabled()) {
    const { db, composerSends } = await loadDb();
    const row = { id: record.id, packageId: record.packageId, createdAt: new Date(record.createdAt), data: record };
    await db
      .insert(composerSends)
      .values(row)
      .onConflictDoUpdate({
        target: composerSends.id,
        set: { packageId: row.packageId, createdAt: row.createdAt, data: row.data },
      });
    return;
  }
  const store = await load();
  store.sends = [record, ...store.sends];
  await persist();
}

// ── Workspace context ─────────────────────────────────────────

export async function getWorkspaceContextData(orgId: string): Promise<WorkspaceContextData> {
  if (pgEnabled()) {
    const { db, composerWorkspaces } = await loadDb();
    const [row] = await db
      .select()
      .from(composerWorkspaces)
      .where(eq(composerWorkspaces.orgId, orgId))
      .limit(1);
    return row ? (row.data as WorkspaceContextData) : DEFAULT_WORKSPACE;
  }
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
