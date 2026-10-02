import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2);
assert(roots.length, 'Provide at least one Expo production export directory');
const forbidden = ['Local phone preview', 'zuno.local-phone.session.v1', 'six-zero test code'];
for (const root of roots) {
  let bundles = 0;
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(js|hbc)$/.test(entry.name)) {
        bundles++;
        const bytes = readFileSync(file);
        for (const marker of forbidden)
          assert(
            !bytes.includes(Buffer.from(marker)),
            `Local authentication fixture leaked into ${file}`,
          );
      }
    }
  }
  walk(root);
  assert(bundles > 0, `No JS/Hermes bundles found in ${root}`);
  console.log(
    `PASS: ${root}, ${bundles} production bundles, no local phone authentication fixture`,
  );
}
