/**
 * Patch @firebase/auth to fix upstream bug:
 * "INTERNAL ASSERTION FAILED: Pending promise was never set"
 * 
 * In @firebase/auth, when popup or redirect auth is cancelled, times out, or fails,
 * internal event listeners can invoke resolve/reject a second time after unregisterAndCleanUp()
 * has already set this.pendingPromise = null.
 * 
 * Guarding resolve and reject prevents this assertion from crashing the window.
 */
const fs = require('fs');
const path = require('path');

const targetDirs = [
  path.join(__dirname, '../node_modules/@firebase/auth/dist'),
  path.join(__dirname, '../node_modules/firebase/node_modules/@firebase/auth/dist')
];

let patchedCount = 0;

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      patchFile(fullPath);
    }
  }
}

function patchFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const targetPattern = /debugAssert\(this\.pendingPromise,\s*['"]Pending promise was never set['"]\);/g;
    if (targetPattern.test(content)) {
      content = content.replace(targetPattern, 'if (!this.pendingPromise) { return; }');
      fs.writeFileSync(filePath, content, 'utf8');
      patchedCount++;
      console.log(`[Patch] Successfully patched @firebase/auth in: ${path.relative(process.cwd(), filePath)}`);
    }
  } catch (err) {
    console.warn(`[Patch] Could not patch ${filePath}:`, err.message);
  }
}

for (const dir of targetDirs) {
  walkDir(dir);
}

console.log(`[Patch] Complete. Patched ${patchedCount} files in @firebase/auth.`);
