import type { Request } from 'express';
import { isMockMode } from '../mock.js';
import { resolveOrgForKey } from './apikeys.js';

export interface AuthResult {
  orgId: string;
  key: string;
}

/**
 * Resolve a request to a tenant, in priority order:
 *   1. mock mode — any non-empty key maps to a per-key demo org.
 *   2. a minted, non-revoked API key in the database → its org.
 *   3. the shared COMPOSER_API_KEY (admin / back-compat) → admin org.
 *   4. no DB and no shared key configured — permissive local dev: any key.
 * A configured database means unknown keys are rejected (real multi-tenant).
 */
export async function authenticate(req: Request): Promise<AuthResult | null> {
  const header = req.headers['authorization'] ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  const key = match?.[1]?.trim();
  if (!key) return null;

  if (isMockMode()) return { orgId: `org-${key.slice(0, 12)}`, key };

  const orgFromDb = await resolveOrgForKey(key);
  if (orgFromDb) return { orgId: orgFromDb, key };

  const expected = process.env['COMPOSER_API_KEY'];
  if (expected) {
    return key === expected
      ? { orgId: process.env['COMPOSER_ADMIN_ORG_ID'] ?? 'org-admin', key }
      : null;
  }

  // No shared key set. With a DB provisioned, only minted keys are valid.
  if (process.env['DATABASE_URL']) return null;

  // Pure local dev (no DB, no shared key): stay permissive.
  return { orgId: `org-${key.slice(0, 12)}`, key };
}
