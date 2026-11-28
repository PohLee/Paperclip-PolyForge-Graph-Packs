import { readFileSync, writeFileSync } from 'node:fs';
import { mergeProducers } from '../packs/adlc/merge-producers.mjs';

const row = mergeProducers.find(producer => producer.packId === 'creative-team');
const file = new URL('../packs/adlc-creative-team/graphs/design-publication.mjs', import.meta.url);
const content = '// Generated from packs/adlc/merge-producers.mjs by scripts/sync-design-publication.mjs.\n' +
  'export const designPublication = Object.freeze({ ...' + JSON.stringify(row, null, 2) +
  ', versions: Object.freeze(' + JSON.stringify(row.versions) + ') });\n';

if (process.argv.includes('--check')) {
  if (readFileSync(file, 'utf8') !== content) {
    throw new Error('Run node scripts/sync-design-publication.mjs to refresh the generated design publication');
  }
} else {
  writeFileSync(file, content);
}
