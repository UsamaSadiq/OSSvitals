import { describe, expect, it } from "vitest";
import { metaFixture } from "../../data/fixtures";
import { exportCsv, exportJson, exportName, rankedRows } from "./ShareExport";

const records = [
  { repo_name: "openedx/b", score_composite: 80, score_letter: "A" as const, checks: {} },
  { repo_name: "openedx/a", score_composite: 80, score_letter: "A" as const, checks: {} },
  { repo_name: "openedx/c", score_composite: 90.5, score_letter: "A" as const, checks: {} },
];

describe("Overview export", () => {
  it("ranks by score descending with ties by repo name", () => {
    expect(rankedRows(records).map((row) => row.repo_name)).toEqual(["openedx/c", "openedx/a", "openedx/b"]);
  });

  it("writes the same CSV columns as the Streamlit export", () => {
    expect(exportCsv(rankedRows(records))).toBe(
      "repo_name,score_composite,score_letter\nopenedx/c,90.5,A\nopenedx/a,80,A\nopenedx/b,80,A\n",
    );
  });

  it("wraps records with the Streamlit export metadata", () => {
    const meta = metaFixture();
    const payload = JSON.parse(exportJson(rankedRows(records), meta));
    expect(Object.keys(payload.metadata)).toEqual([
      "snapshot_timestamp",
      "filters",
      "scoring_config_version",
      "dashboard_version",
      "data_source_url",
    ]);
    expect(payload.metadata.filters).toEqual({ tab: "overview" });
    expect(payload.records).toHaveLength(3);
  });

  it("names files by UTC date", () => {
    expect(exportName(new Date("2026-10-03T23:30:00Z"))).toBe("openedx-health-2026-10-03");
  });
});
