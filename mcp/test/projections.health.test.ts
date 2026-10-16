import { describe, expect, it } from "vitest";
import { VIEW_SCHEMAS } from "../../web/src/data/schemas.ts";
import {
  findCheck,
  findRepo,
  listRepos,
  paginate,
  projectAttention,
  projectCheck,
  projectOverview,
  projectRepo,
  validCheckNames,
} from "../src/projections/health.ts";
import { truncate } from "../src/text.ts";
import attentionJson from "./fixtures/openedx/views/attention.json";
import checksJson from "./fixtures/openedx/views/checks.json";
import overviewJson from "./fixtures/openedx/views/overview.json";
import reposJson from "./fixtures/openedx/views/repos.json";
import repoDetailJson from "./fixtures/openedx/views/repo_detail.json";

const overview = VIEW_SCHEMAS.overview.parse(overviewJson);
const repos = VIEW_SCHEMAS.repos.parse(reposJson);
const checks = VIEW_SCHEMAS.checks.parse(checksJson);
const attention = VIEW_SCHEMAS.attention.parse(attentionJson);
const firstPage = { page: 1, page_size: 25 };

describe("truncate", () => {
  it("passes through nullish and short values", () => {
    expect(truncate(null, 5)).toBeNull();
    expect(truncate(undefined, 5)).toBeNull();
    expect(truncate("short", 5)).toBe("short");
  });

  it("cuts long values and appends an ellipsis", () => {
    expect(truncate("abcdefgh", 5)).toBe("abcde…");
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5];

  it("slices the requested page", () => {
    expect(paginate(items, { page: 2, page_size: 2 })).toEqual({ total: 5, page: 2, page_size: 2, records: [3, 4] });
  });

  it("returns a short last page and an empty page past the end", () => {
    expect(paginate(items, { page: 3, page_size: 2 }).records).toEqual([5]);
    expect(paginate(items, { page: 9, page_size: 2 }).records).toEqual([]);
  });
});

describe("projectOverview", () => {
  it("keeps the compact summary with capped lists", () => {
    const projected = projectOverview(overview);
    expect(projected.kpis.repos).toBe(169);
    expect(projected.kpi_baseline_date).toBe("2026-10-04");
    expect(projected.top_failing).toHaveLength(10);
    expect(projected.movers.gainers.length).toBeLessThanOrEqual(10);
    expect(projected.movers_from).toBe(overview.movers_from);
    expect(projected).not.toHaveProperty("highlights");
  });
});

describe("listRepos", () => {
  it("sorts by score descending by default and reports totals", () => {
    const result = listRepos(repos, {}, firstPage);
    expect(result.total).toBe(7);
    const scores = result.records.map((record) => record.score_composite);
    expect(scores).toEqual([...scores].sort((left, right) => right - left));
    expect(result.records[0]).toHaveProperty("failing_count");
  });

  it("counts failing checks and resolves the owner", () => {
    const record = listRepos(repos, {}, firstPage).records.find((entry) => entry.repo_name === "openedx/credentials");
    expect(record?.owner).toBe("jajjibhai008");
    const source = findRepo(repos, "credentials");
    expect(record?.failing_count).toBe(Object.values(source?.checks ?? {}).filter((state) => state === "fail").length);
  });

  it("sorts by name and by last push", () => {
    const names = listRepos(repos, { sort: "name" }, firstPage).records.map((record) => record.repo_name);
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right)));
    const pushes = listRepos(repos, { sort: "last_push" }, firstPage).records.map((record) => record.last_push ?? "");
    expect(pushes).toEqual([...pushes].sort().reverse());
  });

  it("filters by score range, letter and tier", () => {
    const bounded = listRepos(repos, { min_score: 60, max_score: 70 }, firstPage);
    expect(bounded.records.every((record) => record.score_composite >= 60 && record.score_composite <= 70)).toBe(true);
    const letter = listRepos(repos, { letter: "B" }, firstPage);
    expect(letter.records.every((record) => record.score_letter === "B")).toBe(true);
    expect(listRepos(repos, { tier: "STANDARD" }, firstPage).total).toBeGreaterThan(0);
    expect(listRepos(repos, { tier: "nonexistent" }, firstPage).total).toBe(0);
  });

  it("filters by failing check", () => {
    const result = listRepos(repos, { failing_check: "dependabot.exists" }, firstPage);
    expect(result.total).toBeGreaterThan(0);
    expect(listRepos(repos, { failing_check: "Dependabot.Exists" }, firstPage).total).toBe(result.total);
    for (const record of result.records) {
      expect(findRepo(repos, record.repo_name)?.checks["dependabot.exists"]).toBe("fail");
    }
  });

  it("matches the owner against name and handles case-insensitively", () => {
    expect(listRepos(repos, { owner: "SAMEERAMIN" }, firstPage).records.map((r) => r.repo_name)).toEqual([
      "openedx/license-manager",
    ]);
    expect(listRepos(repos, { owner: "group:2u-phoenix" }, firstPage).total).toBe(1);
    expect(listRepos(repos, { owner: "nobody" }, firstPage).total).toBe(0);
  });

  it("paginates within bounds", () => {
    const second = listRepos(repos, {}, { page: 2, page_size: 3 });
    expect(second.records).toHaveLength(3);
    expect(listRepos(repos, {}, { page: 3, page_size: 3 }).records).toHaveLength(1);
    expect(listRepos(repos, {}, { page: 4, page_size: 3 }).records).toEqual([]);
  });
});

describe("findRepo", () => {
  it("matches full and prefix-less names case-insensitively", () => {
    expect(findRepo(repos, "openedx/course-discovery")?.repo_name).toBe("openedx/course-discovery");
    expect(findRepo(repos, "License-Manager")?.repo_name).toBe("openedx/license-manager");
    expect(findRepo(repos, "OPENEDX/xblock")?.repo_name).toBe("openedx/XBlock");
  });

  it("returns null for unknown repos", () => {
    expect(findRepo(repos, "does-not-exist")).toBeNull();
  });
});

describe("projectRepo", () => {
  it("builds failing checks with titles from the checks view", () => {
    const record = findRepo(repos, "course-discovery");
    if (!record) throw new Error("fixture missing");
    const projected = projectRepo(record, checks);
    expect(projected.subscores).toEqual({ structural: 66.67, activity: 65.38 });
    expect(projected.owners.handles).toContain("2u-phoenix");
    const dependabot = projected.failing_checks.find((entry) => entry.check === "dependabot.exists");
    expect(dependabot).toEqual({
      check: "dependabot.exists",
      title: "Dependabot Config",
      category: "Dependencies",
      has_remediation: true,
      fix_pr: null,
    });
    const total = projected.failing_checks.length + projected.passing_count + projected.unknown_count;
    expect(total).toBe(Object.keys(record.checks).length);
  });

  it("attaches the open fix PR from the detail entry to its failing check", () => {
    const record = findRepo(repos, "course-discovery");
    if (!record) throw new Error("fixture missing");
    const fixPr = { pr_number: 7, pr_url: "https://github.com/openedx/course-discovery/pull/7", pr_title: "chore: add dependabot config", author: "someone", is_draft: true, created_at: null, open_count: 2 };
    const base = VIEW_SCHEMAS.repo_detail.parse(repoDetailJson).repos["openedx/course-discovery"];
    if (!base) throw new Error("fixture missing");
    const detail = { ...base, fix_prs: { "dependabot.exists": fixPr } };
    const projected = projectRepo(record, checks, detail);
    const dependabot = projected.failing_checks.find((entry) => entry.check === "dependabot.exists");
    expect(dependabot?.fix_pr).toEqual({ number: 7, url: fixPr.pr_url, title: fixPr.pr_title, author: "someone", is_draft: true, open_count: 2 });
  });
});

describe("checks", () => {
  it("finds checks case-insensitively and projects remediation and pr template", () => {
    const record = findCheck(checks, "DEPENDABOT.EXISTS");
    if (!record) throw new Error("fixture missing");
    const projected = projectCheck(record);
    expect(projected.title).toBe("Dependabot Config");
    expect(projected.scored_by).toBeNull();
    expect(projected.remediation?.issue_body).toContain("dependabot.exists");
    expect(projected.pr_template?.branch).toBe("chore/dependabot-config");
  });

  it("truncates long check descriptions", () => {
    const record = findCheck(checks, "dependabot.exists");
    if (!record) throw new Error("fixture missing");
    const long = { ...record, description: { description: "x".repeat(400) } };
    expect(projectCheck(long).description).toBe(`${"x".repeat(300)}…`);
  });

  it("omits remediation blocks when absent", () => {
    const record = findCheck(checks, "dependabot.exists");
    if (!record) throw new Error("fixture missing");
    const projected = projectCheck({ ...record, remediation: null, pr_template: null, has_remediation: false });
    expect(projected).not.toHaveProperty("remediation");
    expect(projected).not.toHaveProperty("pr_template");
  });

  it("returns null for unknown checks and caps valid names at 30", () => {
    expect(findCheck(checks, "nope")).toBeNull();
    expect(validCheckNames(checks)).toHaveLength(30);
  });
});

describe("projectAttention", () => {
  it("projects and paginates records", () => {
    const result = projectAttention(attention, { page: 1, page_size: 2 });
    expect(result.total).toBe(3);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toEqual({
      repo_name: "openedx/edx-notes-api",
      repo_tier: "important",
      score_composite: 75.17,
      score_letter: "B",
      reasons: "important tier with 5+ failing checks",
    });
    expect(projectAttention(attention, { page: 2, page_size: 2 }).records).toHaveLength(1);
  });
});
