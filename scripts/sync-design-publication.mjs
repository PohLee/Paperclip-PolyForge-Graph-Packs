import { writeFileSync } from 'node:fs';
import { mergeProducers } from '../packs/adlc/merge-producers.mjs';

const row = mergeProducers.find(producer => producer.packId === 'creative-team');
writeFileSync(new URL('../packs/adlc-creative-team/graphs/design-publication.mjs', import.meta.url),
  '// Generated from packs/adlc/merge-producers.mjs by scripts/sync-design-publication.mjs.\n' +
  'export const designPublication = Object.freeze({ ...' + JSON.stringify(row, null, 2) +
  ', versions: Object.freeze(' + JSON.stringify(row.versions) + ') });\n');
