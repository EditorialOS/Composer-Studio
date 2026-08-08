// Multi-tenant API keys. A Bearer token maps to an org (tenant) via a
// SHA-256 hash stored in Postgres — the raw key is shown once at mint time
// and never persisted. Active only in real mode with a DATABASE_URL; in
// mock mode or without a DB, resolution returns null and callers fall back
// to the shared COMPOSER_API_KEY / permissive dev behavior.

import { createHash, randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { loadDb, pgEnabled } from './db.js';

const KEY_PREFIX = 'cmp_live_';

/** SHA-256 hex of a raw key — the only form ever stored. */
export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey.trim()).digest('hex');
}

/** A fresh, high-entropy key. Prefix marks it as a live Composer key. */
export function generateKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString('hex')}`;
}

/**
 * Resolve a raw Bearer token to its org, or null if it isn't a known,
 * non-revoked key. Best-effort updates last_used_at. No-ops (returns null)
 * when Postgres isn't configured.
 */
export async function resolveOrgForKey(rawKey: string): Promise<string | null> {
  if (!pgEnabled()) return null;
  const trimmed = rawKey.trim();
  if (!trimmed) return null;

  const { db, composerApiKeys } = await loadDb();
  const [row] = await db
    .select()
    .from(composerApiKeys)
    .where(and(eq(composerApiKeys.keyHash, hashKey(trimmed)), eq(composerApiKeys.revoked, false)))
    .limit(1);
  if (!row) return null;

  try {
    await db
      .update(composerApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(composerApiKeys.id, row.id));
  } catch {
    // last-used tracking is best-effort — never block auth on it
  }
  return row.orgId;
}

export interface CreatedApiKey {
  id: string;
  orgId: string;
  label: string;
  /** Plaintext key — returned once, never stored. */
  key: string;
}

/** Mint a new key for an org and persist only its hash. */
export async function createApiKey(orgId: string, label = 'default'): Promise<CreatedApiKey> {
  if (!pgEnabled()) {
    throw new Error('createApiKey requires real mode with DATABASE_URL set.');
  }
  const { db, composerApiKeys } = await loadDb();
  const key = generateKey();
  const id = `key-${randomBytes(8).toString('hex')}`;
  await db.insert(composerApiKeys).values({
    id,
    orgId,
    keyHash: hashKey(key),
    label,
    revoked: false,
  });
  return { id, orgId, label, key };
}

/** Revoke a key by id. Returns true if a row was affected. */
export async function revokeApiKey(id: string): Promise<boolean> {
  if (!pgEnabled()) return false;
  const { db, composerApiKeys } = await loadDb();
  const rows = await db
    .update(composerApiKeys)
    .set({ revoked: true })
    .where(eq(composerApiKeys.id, id))
    .returning({ id: composerApiKeys.id });
  return rows.length > 0;
}
