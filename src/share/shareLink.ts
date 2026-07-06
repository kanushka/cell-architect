import LZString from "lz-string";

const SHARE_PARAM = "s";

export function encodeShareSource(source: string): string {
  return LZString.compressToEncodedURIComponent(source);
}

export function decodeShareSource(param: string): string | null {
  try {
    const decoded = LZString.decompressFromEncodedURIComponent(param);
    return decoded ? decoded : null;
  } catch {
    return null;
  }
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
