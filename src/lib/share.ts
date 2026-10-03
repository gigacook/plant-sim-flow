"use client";
// Share a model through the URL hash (#m=…): compressed JSON, no server involved.
import type { Model } from "./sim/types";

const toB64Url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeModel(model: Model): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(model));
  if (typeof CompressionStream === "undefined") return "j" + toB64Url(json);
  return "z" + toB64Url(await pipe(json, new CompressionStream("deflate-raw")));
}

export async function decodeModel(code: string): Promise<unknown> {
  const raw = fromB64Url(code.slice(1));
  const bytes = code[0] === "z" ? await pipe(raw, new DecompressionStream("deflate-raw")) : raw;
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
}

export async function shareUrl(model: Model): Promise<string> {
  return `${window.location.origin}${basePath()}/app/#m=${await encodeModel(model)}`;
}
