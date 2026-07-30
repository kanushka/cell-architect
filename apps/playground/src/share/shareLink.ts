import LZString from "lz-string";

const SHARE_PARAM = "s";

/**
 * Upper bound on the DSL a share link may carry, applied *after* decompression.
 *
 * Share links are attacker-controlled input: the payload arrives compressed in
 * the URL fragment, so a short link expands to a much larger source (LZ-String
 * reaches ~6x on repetitive DSL, and far more on a crafted payload). Without a
 * cap, a link that is trivially small to send expands into thousands of nodes
 * and hangs the recipient's tab. Real diagrams are a few kilobytes; 100k
 * characters is generous enough that no legitimate diagram hits it.
 */
export const MAX_SHARE_SOURCE_CHARS = 100_000;

export type ShareDecodeResult =
  | { ok: true; source: string }
  | { ok: false; reason: "invalid" | "too-large" };

export function encodeShareSource(source: string): string {
  return LZString.compressToEncodedURIComponent(source);
}

export function decodeShareSource(param: string): ShareDecodeResult {
  let decoded: string | null;

  try {
    decoded = LZString.decompressFromEncodedURIComponent(param);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (!decoded) {
    return { ok: false, reason: "invalid" };
  }

  if (decoded.length > MAX_SHARE_SOURCE_CHARS) {
    return { ok: false, reason: "too-large" };
  }

  return { ok: true, source: decoded };
}

export function buildShareUrl(source: string): string {
  const encoded = encodeShareSource(source);
  return `${location.origin}${location.pathname}#${SHARE_PARAM}=${encoded}`;
}

export function readShareParam(): string | null {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : location.hash;
  const prefix = `${SHARE_PARAM}=`;
  return hash.startsWith(prefix) ? hash.slice(prefix.length) : null;
}

export function clearShareUrl(): void {
  history.replaceState(null, "", location.pathname + location.search);
}
