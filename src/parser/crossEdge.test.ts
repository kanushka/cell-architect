import { describe, expect, it } from "vitest";
import { parseDirToken, parseCrossEdge } from "./crossEdge";

describe("parseDirToken", () => {
  it("defaults to east/west when no token is given", () => {
    expect(parseDirToken(undefined)).toEqual({ exit: "east", entry: "west" });
  });
  it("expands a bare east to east/west", () => {
    expect(parseDirToken("east")).toEqual({ exit: "east", entry: "west" });
  });
  it("parses east-north", () => {
    expect(parseDirToken("east-north")).toEqual({ exit: "east", entry: "north" });
  });
  it("parses south-north and south-west", () => {
    expect(parseDirToken("south-north")).toEqual({ exit: "south", entry: "north" });
    expect(parseDirToken("south-west")).toEqual({ exit: "south", entry: "west" });
  });
  it("rejects a bare south (no explicit entry)", () => {
    expect(parseDirToken("south")).toEqual({ error: "bare-south" });
  });
  it("rejects an inbound exit or outbound entry", () => {
    expect(parseDirToken("west")).toEqual({ error: "bad-token" });
    expect(parseDirToken("east-south")).toEqual({ error: "bad-token" });
  });
});

describe("parseCrossEdge", () => {
  it("parses an inline cross edge with a bare local source", () => {
    expect(parseCrossEdge("api -> east-north products.api : get stock", 12)).toEqual({
      sourceCell: null, sourceComp: "api", targetCell: "products", targetComp: "api",
      exit: "east", entry: "north", label: "get stock", line: 12
    });
  });
  it("parses a project-level cross edge with both ends qualified", () => {
    expect(parseCrossEdge("orders.api -> products.stock", 3)).toEqual({
      sourceCell: "orders", sourceComp: "api", targetCell: "products", targetComp: "stock",
      exit: "east", entry: "west", label: undefined, line: 3
    });
  });
  it("returns null when the target is not qualified (not a cross edge)", () => {
    expect(parseCrossEdge("api -> east InventoryAPI", 1)).toBeNull();
  });
  it("returns a bare-south error result", () => {
    expect(parseCrossEdge("api -> south products.api", 5)).toEqual({ error: "bare-south", line: 5 });
  });
});
