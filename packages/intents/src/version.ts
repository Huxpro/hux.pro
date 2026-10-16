// =============================================================================
// Versions: the intent layer, kept and passed on.
//
//   saved     the author's tree, written to content/scenes/<scene>.intents.json
//             (dev only, like the Lab's other editors) and served beside the
//             built experiences, which load it over the tree in their code.
//   shared    any version as a link: the tree, compressed into the address's
//             fragment. Opening one plays that version; changing anything makes
//             a new version whose parent it is (a remix).
//
// A saved or shared tree is rebased onto the code's tree when it loads (by
// key, as a model's answer is): regenerate the code and the edits carry over.
// =============================================================================

import type { Tree, Version } from "./tree";

export interface Saved {
  version: Version;
  tree: Tree;
  savedAt?: string;
}

const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** A version as a link fragment (`#v=…`). */
export async function encodeVersion(v: Saved): Promise<string> {
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(v)), new CompressionStream("deflate-raw"));
  return b64url(bytes);
}

export async function decodeVersion(s: string): Promise<Saved | null> {
  try {
    const bytes = await pipe(unb64url(s), new DecompressionStream("deflate-raw"));
    const v = JSON.parse(new TextDecoder().decode(bytes)) as Saved;
    return v?.tree?.nodes ? v : null;
  } catch {
    return null;
  }
}

/** The version in an address (`#v=…`), if any. */
export function versionInHash(hash: string): string | null {
  const m = /[#&]v=([A-Za-z0-9_-]+)/.exec(hash);
  return m ? m[1] : null;
}

export const newId = () => Math.random().toString(36).slice(2, 8);

/** Where a scene's saved tree is served (built from content/scenes, written there by the save route in dev). */
export const savedUrl = (scene: string) => `/scenes/_data/${scene}.intents.json`;
