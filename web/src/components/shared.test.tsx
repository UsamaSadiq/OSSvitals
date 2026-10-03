import { render, screen, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { fieldColumns, toCsv } from "../format/csv";
import { QuerySelect, useQueryValue } from "./QuerySelect";
import { shareUrl } from "./ShareLink";

describe("toCsv", () => {
  it("quotes cells with commas, quotes and newlines and leaves nulls empty", () => {
    const rows = [{ repo: "a,b", note: 'say "hi"', score: 1.5, extra: null }];
    expect(toCsv(fieldColumns<(typeof rows)[number]>(["repo", "note", "score", "extra"]), rows)).toBe(
      'repo,note,score,extra\n"a,b","say ""hi""",1.5,\n',
    );
  });

  it("writes only the header for no rows", () => {
    expect(toCsv(fieldColumns<{ a: number }>(["a"]), [])).toBe("a\n");
  });
});

describe("shareUrl", () => {
  it("keeps the path and query", () => {
    expect(shareUrl("https://next.ossvitals.org", "/needing_attention", "?tier=critical")).toBe(
      "https://next.ossvitals.org/needing_attention?tier=critical",
    );
  });
});

function Probe() {
  const value = useQueryValue("tier", ["all", "critical"], "all");
  const { search } = useLocation();
  return (
    <>
      <QuerySelect label="Tier filter" param="tier" options={["all", "critical"]} defaultValue="all" />
      <output data-testid="value">{value}</output>
      <output data-testid="search">{search}</output>
    </>
  );
}

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/", element: <Probe /> }], { initialEntries: [path] });
  render(<RouterProvider router={router} />);
}

describe("QuerySelect", () => {
  it("reads a valid value from the query and ignores an unknown one", () => {
    renderAt("/?tier=critical");
    expect(screen.getByTestId("value").textContent).toBe("critical");
  });

  it("falls back to the default for an unknown value", () => {
    renderAt("/?tier=bogus");
    expect(screen.getByTestId("value").textContent).toBe("all");
  });

  it("writes the choice to the query and drops it when back to the default", () => {
    renderAt("/");
    fireEvent.change(screen.getByLabelText("Tier filter"), { target: { value: "critical" } });
    expect(screen.getByTestId("search").textContent).toBe("?tier=critical");
    fireEvent.change(screen.getByLabelText("Tier filter"), { target: { value: "all" } });
    expect(screen.getByTestId("search").textContent).toBe("");
  });
});
