// Fails when a banned product name appears in user-facing code or metadata.
import fs from 'node:fs';
import path from 'node:path';

const BANNED = /\b(ordo|ordokey|\$MRD|dossier|bulwark|laurel)\b|\bAI agents?\b/i;
const DIRS = ['app', 'components', 'lib', 'public', 'backend/src', 'backend/test'];
const EXT = new Set(['.ts', '.tsx', '.css', '.svg', '.json', '.html', '.prisma']);

let failed = false;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.has(path.extname(e.name))) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (BANNED.test(line)) {
          console.error(`${p}:${i + 1}: ${line.trim().slice(0, 120)}`);
          failed = true;
        }
      });
    }
  }
};
DIRS.filter((d) => fs.existsSync(d)).forEach(walk);
process.exit(failed ? 1 : 0);
