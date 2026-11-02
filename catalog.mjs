import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { packs as sourcePacks, packCatalog as sourcePackCatalog } from './index.mjs';

// These release files are installed alongside the package by the deployment.
// Keep this list explicit so an unrelated file in dist never becomes executable.
const installedReleasePaths = [
  ['adlc', '0.2.0'],
  ['adlc', '0.2.1'],
  ['adlc', '0.2.3'],
  ['adlc', '0.2.4'],
  ['adlc', '0.2.5'],
  ['marketing', '0.0.1'],
  ['marketing', '0.0.3'],
  ['creative-team', '0.1.0'],
  ['creative-team', '0.2.0'],
];
const root = fileURLToPath(new URL('.', import.meta.url));

function loadInstalledRelease(id, version) {
  const dir = resolve(root, 'dist', id, version);
  const payloadPath = resolve(dir, 'pack.json');
  const releasePath = resolve(dir, 'release.json');
  const hasPayload = existsSync(payloadPath);
  const hasRelease = existsSync(releasePath);
  if (!hasPayload && !hasRelease) return null;
  if (!hasPayload || !hasRelease) throw new Error(`Incomplete installed Pack release: ${id}@${version}`);
  const bytes = readFileSync(payloadPath);
  const payload = JSON.parse(bytes.toString('utf8'));
  const metadata = JSON.parse(readFileSync(releasePath, 'utf8'));
  const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (payload.id !== id || payload.version !== version || payload.release !== undefined ||
      metadata.packId !== id || metadata.version !== version || metadata.digest !== digest) {
    throw new Error(`Invalid installed Pack release: ${id}@${version}`);
  }
  const { packId: _packId, version: _version, ...release } = metadata;
  return { ...payload, release };
}

export const installedPacks = Object.freeze(installedReleasePaths.map(([id, version]) =>
  loadInstalledRelease(id, version)).filter(Boolean));
const byVersion = new Map();
for (const pack of [...installedPacks, ...sourcePacks]) {
  const key = `${pack.id}@${pack.version}`;
  const existing = byVersion.get(key);
  if (existing && existing.release?.digest !== pack.release?.digest) {
    throw new Error(`Conflicting Pack payload for ${key}`);
  }
  if (!existing) byVersion.set(key, pack);
}

export const packs = Object.freeze([...byVersion.values()]);
export const packCatalog = sourcePackCatalog;
export const latestPacks = sourcePacks;
