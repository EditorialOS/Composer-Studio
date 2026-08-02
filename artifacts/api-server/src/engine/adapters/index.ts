import { isMockMode } from '../../mock.js';
import type { ComposerAdapters } from '../types.js';
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

/**
 * The adapter seam. COMPOSER_MOCK=1 → every adapter is a mock with rich
 * fixtures; otherwise real implementations read env config and degrade
 * honestly when a capability isn't connected.
 */
export function getAdapters(): ComposerAdapters {
  if (cached) return cached;
  cached = isMockMode()
    ? {
        webSearch: new MockSearchAdapter(),
        imageLibrary: new MockAssetAdapter(),
        archive: new MockArchiveAdapter(),
        rights: new MockRightsAdapter(),
        send: new MockSendAdapter(),
        llm: new MockModelAdapter(),
      }
    : {
        webSearch: new RealSearchAdapter(),
        imageLibrary: new RealAssetAdapter(),
        archive: new RealArchiveAdapter(),
        rights: new RealRightsAdapter(),
        send: new RealSendAdapter(),
        llm: new RealModelAdapter(),
      };
  return cached;
}
