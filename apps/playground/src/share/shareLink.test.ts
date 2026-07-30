import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildShareUrl,
  clearShareUrl,
  decodeShareSource,
  encodeShareSource,
  MAX_SHARE_SOURCE_CHARS,
  readShareParam
} from "./shareLink";

const sample = `title OrderProject\nversion v1\n\ncomponent api\ncomponent OrderService\n\nnorth ca as "Customer App" webapp\n\nca -> api : HTTPS\napi -> OrderService`;

describe("shareLink", () => {
  const originalHash = location.hash;

  afterEach(() => {
    history.replaceState(null, "", location.pathname + location.search);
    location.hash = originalHash;
  });

  it("round-trips source through encode and decode", () => {
    const encoded = encodeShareSource(sample);
    expect(decodeShareSource(encoded)).toEqual({ ok: true, source: sample });
  });

  it("reports corrupted/garbage input as invalid", () => {
    expect(decodeShareSource("@@@not-valid@@@")).toEqual({ ok: false, reason: "invalid" });
  });

  it("reports empty input as invalid", () => {
    expect(decodeShareSource("")).toEqual({ ok: false, reason: "invalid" });
  });

  it("accepts a source at the size limit", () => {
    const atLimit = "c".repeat(MAX_SHARE_SOURCE_CHARS);
    expect(decodeShareSource(encodeShareSource(atLimit))).toEqual({ ok: true, source: atLimit });
  });

  it("rejects a compression-bomb link that expands past the size limit", () => {
    // Highly repetitive input compresses enormously, so the link itself stays
    // small while the decompressed source does not. This is the shape of a
    // payload crafted to hang the recipient's browser.
    const oversized = "component c service\n".repeat(20_000);
    const encoded = encodeShareSource(oversized);

    expect(oversized.length).toBeGreaterThan(MAX_SHARE_SOURCE_CHARS);
    expect(encoded.length).toBeLessThan(oversized.length / 10);
    expect(decodeShareSource(encoded)).toEqual({ ok: false, reason: "too-large" });
  });

  it("builds a share url with the encoded source in the hash", () => {
    const url = buildShareUrl(sample);
    expect(url).toBe(`${location.origin}${location.pathname}#s=${encodeShareSource(sample)}`);
  });

  describe("readShareParam", () => {
    beforeEach(() => {
      location.hash = "";
    });

    it("reads the s param from the hash", () => {
      const encoded = encodeShareSource(sample);
      location.hash = `#s=${encoded}`;
      expect(readShareParam()).toBe(encoded);
    });

    it("returns null when there is no hash", () => {
      expect(readShareParam()).toBeNull();
    });
  });

  describe("clearShareUrl", () => {
    it("strips the hash from the url", () => {
      location.hash = "#s=something";
      clearShareUrl();
      expect(location.hash).toBe("");
    });
  });
});
