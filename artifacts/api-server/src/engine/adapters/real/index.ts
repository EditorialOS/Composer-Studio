// Real adapters — minimal stubs that degrade honestly when env vars are
// missing. Wire each adapter by setting the documented env vars.
// In COMPOSER_MOCK=1 mode these are never instantiated.

import type {
  ArchiveAdapter,
  ArchiveResult,
  AssetAdapter,
  Derivative,
  MatchedAsset,
  ModelAdapter,
  ParsedBrief,
  ComposeInput,
  GateEvaluation,
  RightsAdapter,
  SearchAdapter,
  SendAdapter,
  SendDestination,
  SendRecord,
  ComposerPackage,
  WorkspaceContextData,
} from '../../types.js';
import { buildDerivatives } from '../../derivatives.js';

function notConfigured(adapter: string, vars: string[]): string {
  return `${adapter} not configured — set ${vars.join(' + ')} to activate.`;
}

export class RealSearchAdapter implements SearchAdapter {
  name = 'web-search';
  async capabilities() { return { webSearch: false }; }
  async searchMarketContext(_parsed: ParsedBrief) {
    return { available: false, intro: '', competitors: [], facts: [], note: notConfigured('Web search', ['TAVILY_API_KEY (or BRAVE_API_KEY / PERPLEXITY_API_KEY)']) };
  }
}

export class RealAssetAdapter implements AssetAdapter {
  name = 'cloudinary';
  async capabilities() { return { tagSearch: false, visualSearch: false, derivatives: true, rightsMetadata: false }; }
  async searchAssets(_parsed: ParsedBrief): Promise<MatchedAsset[]> { return []; }
  async listAssets(): Promise<MatchedAsset[]> { return []; }
  buildDerivatives(asset: MatchedAsset): Derivative[] { return buildDerivatives(asset); }
}

export class RealArchiveAdapter implements ArchiveAdapter {
  name = 'google-drive';
  async capabilities() { return { connected: false, deepSearch: false }; }
  async searchArchive(_parsed: ParsedBrief, _depth: string): Promise<ArchiveResult> {
    return { connected: false, adapterName: this.name, findings: [], metrics: [], note: notConfigured('Google Drive archive', ['GOOGLE_DRIVE_API_KEY or GOOGLE_SERVICE_ACCOUNT_JSON']) };
  }
}

export class RealRightsAdapter implements RightsAdapter {
  name = 'embedded-xmp';
  async capabilities() { return { embeddedMetadata: true, expiryTracking: true }; }
  async enrichRights(assets: MatchedAsset[]): Promise<MatchedAsset[]> {
    return assets.map((a) =>
      a.rightsStatus === 'unknown' && !a.rightsNote
        ? { ...a, rightsNote: 'No rights metadata embedded — not on file.' }
        : a,
    );
  }
}

export class RealSendAdapter implements SendAdapter {
  name = 'beehiiv';
  async capabilities() { return { beehiivDraft: false, cmsDraft: false, downloadAll: true }; }
  async send(pkg: ComposerPackage, destination: SendDestination): Promise<Omit<SendRecord, 'id' | 'packageId' | 'createdAt'>> {
    if (destination === 'download') {
      return { destination, status: 'download-ready', note: 'Download bundle ready (real mode — link generation not yet implemented).' };
    }
    return { destination, status: 'skipped', note: notConfigured(`${destination} send`, ['BEEHIIV_API_KEY + BEEHIIV_PUBLICATION_ID']) };
  }
}

export class RealModelAdapter implements ModelAdapter {
  name = 'heuristic-fallback';
  async capabilities() { return { gateEval: false, provider: 'none' }; }
  async parseBrief(input: ComposeInput): Promise<ParsedBrief> {
    const firstLine = input.brief.split(/[.\n]/).map((s) => s.trim()).filter(Boolean)[0] ?? 'Untitled';
    return { headline: firstLine.slice(0, 90), subhead: 'real mode · heuristic', kind: 'general', searchTags: [], scenario: 'general' };
  }
  async evaluateGates(_args: { parsed: ParsedBrief; workspace: WorkspaceContextData }): Promise<GateEvaluation> {
    return { gates: [], verdict: 'REVISE', verdictSummary: notConfigured('LLM gate evaluation', ['ANTHROPIC_API_KEY or OPENAI_API_KEY']), requiredRevisions: [], editorNote: 'No model provider configured.' };
  }
  async packageContent(_parsed: ParsedBrief) {
    return { deliverables: [], workflow: [], worked: [], didntWork: [notConfigured('Package content generation', ['ANTHROPIC_API_KEY or OPENAI_API_KEY'])] };
  }
}
