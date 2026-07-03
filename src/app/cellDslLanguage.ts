import { HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from "@codemirror/language";
import { tags as t, Tag } from "@lezer/highlight";

const STATEMENT_KEYWORDS = new Set(["title", "version", "component", "north", "east", "south", "west"]);
const ALIAS_KEYWORD = "as";

const aliasKeywordTag = Tag.define();

export const cellDslStreamParser: StreamParser<Record<string, never>> = {
  name: "cell-dsl",
  startState() {
    return {};
  },
  token(stream) {
    if (stream.eatSpace()) {
      return null;
    }

    if (stream.match(/^(#|\/\/).*/)) {
      return "comment";
    }

    if (stream.match(/^->/)) {
      return "operator";
    }

    if (stream.match(/^"[^"]*"/)) {
      return "string";
    }

    if (stream.match(/^[A-Za-z_][\w-]*/)) {
      const word = stream.current();

      if (word === ALIAS_KEYWORD) {
        return "aliasKeyword";
      }

      if (STATEMENT_KEYWORDS.has(word)) {
        return "keyword";
      }

      return null;
    }

    stream.next();
    return null;
  },
  tokenTable: {
    aliasKeyword: aliasKeywordTag
  }
};

const cellDslHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: "#7c3aed", fontWeight: "600" },
  { tag: aliasKeywordTag, color: "#0f766e", fontWeight: "600", fontStyle: "italic" },
  { tag: t.comment, color: "#6b7280", fontStyle: "italic" },
  { tag: t.operator, color: "#334155", fontWeight: "600" },
  { tag: t.string, color: "#b45309" }
]);

export const cellDslLanguageExtension = [StreamLanguage.define(cellDslStreamParser), syntaxHighlighting(cellDslHighlightStyle)];
