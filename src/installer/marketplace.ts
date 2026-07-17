/**
 * Build a stable, user-owned local marketplace that Claude Code can install
 * the TokenSeal plugin from. We copy the shipped `plugin/` into the user's data
 * dir so the install source never depends on the (possibly read-only or
 * transient) npm package location.
 */
import { join } from 'node:path';
import { cpSync, rmSync, existsSync } from 'node:fs';
import { installedMarketplaceDir, pluginSourceDir } from '../utils/paths.ts';
import { atomicWrite, ensureDir } from '../utils/fs-atomic.ts';

export const MARKETPLACE_NAME = 'tokenseal-marketplace';
export const PLUGIN_NAME = 'tokenseal';
export const PLUGIN_ID = `${PLUGIN_NAME}@${MARKETPLACE_NAME}`;

export interface BuiltMarketplace {
  marketplaceDir: string;
  pluginDir: string;
  statusLineScript: string;
}

function marketplaceManifest(version: string): string {
  return (
    JSON.stringify(
      {
        name: MARKETPLACE_NAME,
        owner: { name: 'TokenSeal contributors' },
        description: 'Local marketplace that installs the TokenSeal efficiency + assurance plugin.',
        plugins: [
          {
            name: PLUGIN_NAME,
            source: './plugin',
            description: 'Seal token leaks. Ship reviewed code.',
            version,
          },
        ],
      },
      null,
      2,
    ) + '\n'
  );
}

/**
 * Copy the plugin into the marketplace dir and write the marketplace manifest.
 * Idempotent: replaces any previous copy so re-running setup refreshes it.
 */
export function buildMarketplace(
  version: string,
  dataDir?: string,
  srcDir = pluginSourceDir(),
): BuiltMarketplace {
  const marketplaceDir = installedMarketplaceDir(dataDir);
  const pluginDir = join(marketplaceDir, 'plugin');
  if (!existsSync(srcDir)) {
    throw new Error(`Plugin source not found at ${srcDir}. Is the package intact?`);
  }
  ensureDir(join(marketplaceDir, '.claude-plugin'));
  // Refresh the plugin copy.
  if (existsSync(pluginDir)) rmSync(pluginDir, { recursive: true, force: true });
  cpSync(srcDir, pluginDir, { recursive: true });
  atomicWrite(
    join(marketplaceDir, '.claude-plugin', 'marketplace.json'),
    marketplaceManifest(version),
    0o644,
  );
  return {
    marketplaceDir,
    pluginDir,
    statusLineScript: join(pluginDir, 'scripts', 'statusline.mjs'),
  };
}

export function removeMarketplaceDir(dataDir?: string): void {
  const dir = installedMarketplaceDir(dataDir);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
