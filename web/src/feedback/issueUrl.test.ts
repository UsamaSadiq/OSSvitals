import { describe, expect, it } from "vitest";
import { newIssueUrl } from "./issueUrl";

const SOURCE = "https://github.com/UsamaSadiq/OSSvitals";

function paramsOf(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams);
}

describe("newIssueUrl", () => {
  it("points at the template for the kind and prefills the form fields", () => {
    const url = newIssueUrl(`${SOURCE}/`, "data", {
      tenant: "moneta",
      title: "alpha drift looks stale",
      page: "https://moneta.ossvitals.org/apps/alpha",
      repo: "alpha",
      dataDate: "2026-10-26",
      details: "Shows 2,500 behind & 3 critical",
    });

    expect(url.startsWith(`${SOURCE}/issues/new?`)).toBe(true);
    expect(paramsOf(url)).toEqual({
      template: "wrong-data.yml",
      title: "alpha drift looks stale",
      tenant: "moneta",
      page: "https://moneta.ossvitals.org/apps/alpha",
      repo: "alpha",
      data_date: "2026-10-26",
      details: "Shows 2,500 behind & 3 critical",
    });
  });

  it("omits fields without a value", () => {
    const url = newIssueUrl(SOURCE, "question", { tenant: "openedx", repo: "" });
    expect(paramsOf(url)).toEqual({ template: "question.yml", tenant: "openedx" });
  });
});
