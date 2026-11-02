import { pack as adlcPack } from './packs/adlc/index.mjs';
import { pack as marketingPack } from './packs/marketing/index.mjs';
import { pack as creativeTeamPack } from './packs/adlc-creative-team/index.mjs';

export { adlcPack, marketingPack, creativeTeamPack };
export const packs = Object.freeze([adlcPack, marketingPack, creativeTeamPack]);
export const packCatalog = Object.freeze(Object.fromEntries(packs.map(pack => [pack.id, pack])));
// Existing ADLC imports keep working during collection adoption.
export const pack = adlcPack;
export default pack;
