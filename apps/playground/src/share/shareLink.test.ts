import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildShareUrl, clearShareUrl, decodeShareSource, encodeShareSource, readShareParam } from "./shareLink";

const sample = `title OrderProject\nversion v1\n\ncomponent api\ncomponent OrderService\n\nnorth ca as "Customer App" webapp\n\nca -> api : HTTPS\napi -> OrderService`;

describe("shareLink", () => {
  const originalHash = location.hash;

  afterEach(() => {
    history.replaceState(null, "", location.pathname + location.search);
    location.hash = originalHash;
  });

  it("round-trips source through encode and decode", () => {
    const encoded = encodeShareSource(sample);
    expect(decodeShareSource(encoded)).toBe(sample);
  });

  it("returns null for corrupted/garbage input", () => {
    expect(decodeShareSource("@@@not-valid@@@")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(decodeShareSource("")).toBeNull();
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
