import { describe, expect, it } from "vitest";
import { bestMatch, matchText, MatchTier, rankSearchables } from "./match";

function item(label: string, keys: string[] = [label]) {
  return { label, keys };
}

describe("matchText", () => {
  it("tiers exact, prefix, substring and subsequence matches case-insensitively", () => {
    expect(matchText("Owners", "owners")?.tier).toBe(MatchTier.Exact);
    expect(matchText("Owners", "own")?.tier).toBe(MatchTier.Prefix);
    expect(matchText("At Risk", "risk")).toEqual({ tier: MatchTier.Substring, position: 3 });
    expect(matchText("edx-platform", "eplt")?.tier).toBe(MatchTier.Subsequence);
    expect(matchText("Owners", "xyz")).toBeNull();
  });

  it("keeps the best match across several keys", () => {
    expect(bestMatch(["openedx/edx-platform", "edx-platform"], "edx")?.tier).toBe(MatchTier.Prefix);
  });
});

describe("rankSearchables", () => {
  it("orders exact before prefix before substring before subsequence", () => {
    const items = [item("xaxbxc"), item("zabc"), item("abcdef"), item("abc")];
    expect(rankSearchables(items, "ABC", 10).map((entry) => entry.label)).toEqual(["abc", "abcdef", "zabc", "xaxbxc"]);
  });

  it("caps the results and returns nothing for an empty query", () => {
    const items = Array.from({ length: 20 }, (_, index) => item(`repo-${index}`));
    expect(rankSearchables(items, "repo", 8)).toHaveLength(8);
    expect(rankSearchables(items, "   ", 8)).toEqual([]);
  });

  it("matches a repository by its short name as a prefix", () => {
    const items = [item("openedx/frontend-app-edx"), item("openedx/edx-platform", ["openedx/edx-platform", "edx-platform"])];
    expect(rankSearchables(items, "edx", 8)[0]?.label).toBe("openedx/edx-platform");
  });
});
