import { isMockMode } from '../../mock.js';
import type { ComposerAdapters } from '../types.js';
import { NO_KEYS, type WorkspaceKeys } from './keys.js';
import {
  MockArchiveAdapter,
  MockAssetAdapter,
  MockModelAdapter,
  MockRightsAdapter,
  MockSearchAdapter,
  MockSendAdapter,
} from './mock/index.js';
import {
  RealArchiveAdapter,
  RealAssetAdapter,
  RealModelAdapter,
  RealRightsAdapter,
  RealSearchAdapter,
  RealSendAdapter,
} from './real/index.js';

let cached: ComposerAdapters | null = null;

function mockAdapters(): ComposerAdapters {
  return {
    webSearch: new MockSearchAdapter(),
    imageLibrary: new MockAssetAdapter(),
    archive: new MockArchiveAdapter(),
    rights: new MockRightsAdapter(),
    send: new MockSendAdapter(),
    llm: new MockModelAdapter(),
  };
}

/**
 * The adapter seam. COMPOSER_MOCK=1 → every adapter is a mock with rich
 * fixtures. Otherwise a hybrid: each capability goes real when configured
 * (per-request `keys` override process env) and falls back to its mock
 * when not, so the pipeline always runs and degrades honestly.
 */
export function getAdapters(keys: WorkspaceKeys = NO_KEYS): ComposerAdapters {
  if (isMockMode()) {
    cached ??= mockAdapters();
    return cached;
  }

  const cloudinaryConfigured = Boolean(
    (keys.cloudinaryCloudName || process.env['CLOUDINARY_CLOUD_NAME']) &&
      (keys.cloudinaryApiKey || process.env['CLOUDINARY_API_KEY']) &&
      (keys.cloudinaryApiSecret || process.env['CLOUDINARY_API_SECRET']),
  );
  const searchConfigured = Boolean(
    keys.serperApiKey ||
      keys.braveApiKey ||
      process.env['SERPER_API_KEY'] ||
      process.env['BRAVE_API_KEY'] ||
      process.env['BRAVE_SEARCH_API_KEY'],
  );
  const sendConfigured = Boolean(
    ((keys.beehiivApiKey || process.env['BEEHIIV_API_KEY']) &&
      (keys.beehiivPublicationId || process.env['BEEHIIV_PUBLICATION_ID'])) ||
      keys.cmsWebhookUrl ||
      process.env['CMS_WEBHOOK_URL'],
  );

  return {
    webSearch: searchConfigured ? new RealSearchAdapter(keys) : new MockSearchAdapter(),
    imageLibrary: cloudinaryConfigured ? new RealAssetAdapter(keys) : new MockAssetAdapter(),
    archive: new RealArchiveAdapter(),
    rights: new RealRightsAdapter(),
    send: sendConfigured ? new RealSendAdapter(keys) : new MockSendAdapter(),
    llm: new RealModelAdapter(keys),
  };
}
