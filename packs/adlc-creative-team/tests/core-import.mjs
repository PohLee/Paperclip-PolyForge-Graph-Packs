import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const coreArtifact=process.env.PINNED_CORE_ARTIFACT;
const moduleUrl=coreArtifact
  ? pathToFileURL(resolve(coreArtifact,'src/core/index.mjs')).href
  : new URL('../../../../Paperclip-PolyForge-Graph/src/core/index.mjs',import.meta.url).href;

export const { GraphEngine }=await import(moduleUrl);
