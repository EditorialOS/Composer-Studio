// Shared database seam. Postgres is used only in real mode with a
// DATABASE_URL provisioned; everything else falls back to the in-memory
// store. The @workspace/db module throws at import time when DATABASE_URL
// is unset, so it is imported lazily — never at module load.

import { isMockMode } from '../mock.js';

export function pgEnabled(): boolean {
  return !isMockMode() && Boolean(process.env['DATABASE_URL']);
}

type DbModule = typeof import('@workspace/db');
let dbModPromise: Promise<DbModule> | null = null;

export function loadDb(): Promise<DbModule> {
  return (dbModPromise ??= import('@workspace/db'));
}
