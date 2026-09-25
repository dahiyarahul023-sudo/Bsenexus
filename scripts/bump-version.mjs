/**
 * bump-version.mjs
 *
 * Runs as the npm `prebuild` step, i.e. automatically before every
 * `npm run build` — including every Publish from AI Studio.
 *
 * It increments the patch segment of APP_VERSION in src/version.ts
 * (2.6.0 → 2.6.1 → 2.6.2 ...), so the version shown in the app
 * (Settings → About → Version) advances on each publish without
 * anyone having to remember to bump it by hand.
 *
 * Safe to run repeatedly; exits quietly (code 0) if the version
 * constant cannot be found, so it can never break a build.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const versionFile = join(root, 'src', 'version.ts');

try {
  const content = readFileSync(versionFile, 'utf8');
  const match = content.match(/APP_VERSION\s*=\s*['"](\d+)\.(\d+)\.(\d+)['"]/);
  if (!match) {
    console.log('[bump-version] APP_VERSION not found — skipping.');
    process.exit(0);
  }
  const next = `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
  writeFileSync(versionFile, content.replace(match[0], `APP_VERSION = '${next}'`));
  console.log(`[bump-version] version bumped to ${next}`);
} catch (err) {
  // Never fail the build because of version bookkeeping.
  console.log(`[bump-version] skipped (${err && err.message ? err.message : err})`);
}
