import { StringStream } from "@codemirror/language";
import { describe, expect, it } from "vitest";
import { cellDslStreamParser } from "./cellDslLanguage";

function tokenizeLine(line: string) {
  const stream = new StringStream(line, 4, 2);
  const state = cellDslStreamParser.startState?.(4) ?? {};
  const tokens: Array<{ text: string; style: string | null }> = [];

  while (!stream.eol()) {
    stream.start = stream.pos;
    const style = cellDslStreamParser.token(stream, state);
    tokens.push({ text: stream.string.slice(stream.start, stream.pos), style });
  }

  return tokens;
}

describe("cellDslStreamParser", () => {
  it("colorizes statement keywords", () => {
    const tokens = tokenizeLine("component API service");

    expect(tokens[0]).toMatchObject({ text: "component", style: "keyword" });
    expect(tokens.find((token) => token.text === "API")?.style).toBeNull();
    expect(tokens.find((token) => token.text === "service")?.style).toBeNull();
  });

  it("colorizes boundary direction keywords", () => {
    const tokens = tokenizeLine("north CustomerApp -> WebApp : HTTPS");

    expect(tokens[0]).toMatchObject({ text: "north", style: "keyword" });
    expect(tokens.find((token) => token.text === "->")?.style).toBe("operator");
  });

  it("colorizes the alias keyword distinctly from other keywords", () => {
    const tokens = tokenizeLine("component api as OrderAPI");

    const asToken = tokens.find((token) => token.text === "as");
    expect(asToken?.style).toBe("aliasKeyword");
    expect(asToken?.style).not.toBe("keyword");
  });

  it("does not treat keyword substrings within identifiers as keywords", () => {
    const tokens = tokenizeLine("component NorthAPI service");

    expect(tokens.find((token) => token.text === "NorthAPI")?.style).toBeNull();
  });

  it("colorizes comments", () => {
    const tokens = tokenizeLine("# this is a comment");

    expect(tokens[0]).toMatchObject({ text: "# this is a comment", style: "comment" });
  });

  it("colorizes the cell keyword", () => {
    const tokens = tokenizeLine("cell orders {");
    expect(tokens[0]).toMatchObject({ text: "cell", style: "keyword" });
  });

  it("colorizes braces as punctuation", () => {
    const tokens = tokenizeLine("cell orders {");
    expect(tokens.find((token) => token.text === "{")?.style).toBe("punctuation");
  });
});
