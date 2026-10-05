import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";
import { Loading } from "./Loading";
import { RepoLink, splitRepoName } from "./RepoName";

describe("Loading", () => {
  it("announces its label and keeps the loading hook the audit waits on", () => {
    render(<Loading label="Loading overview…" />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading overview…");
    expect(status).toHaveClass("loading");
  });
});

describe("EmptyState", () => {
  it("renders info and good as quiet status notes", () => {
    render(
      <>
        <EmptyState kind="info" title="Not collected yet." body="Arrives tomorrow." />
        <EmptyState kind="good" title="All clear." />
      </>,
    );
    const [info, good] = screen.getAllByRole("status");
    expect(info).toHaveClass("note", "empty-state--info");
    expect(info).toHaveTextContent("Not collected yet.Arrives tomorrow.");
    expect(good).toHaveClass("note", "empty-state--good");
    expect(good).toHaveTextContent("All clear.");
  });

  it("keeps warn and error as boxed banners with their roles", () => {
    render(
      <>
        <EmptyState kind="warn" title="Check this." action={{ label: "OEP-55", href: "https://example.org" }} />
        <EmptyState kind="error" title="Broken." />
      </>,
    );
    expect(screen.getByRole("status")).toHaveClass("banner", "banner--warn");
    expect(screen.getByRole("link", { name: "OEP-55" })).toHaveAttribute("href", "https://example.org");
    expect(screen.getByRole("alert")).toHaveClass("banner", "banner--error");
  });
});

describe("RepoName", () => {
  it("splits the org prefix from the short name", () => {
    expect(splitRepoName("openedx/edx-platform")).toEqual({ org: "openedx/", short: "edx-platform" });
    expect(splitRepoName("standalone")).toEqual({ org: "", short: "standalone" });
  });

  it("keeps the full name as the link's accessible name and text", () => {
    render(
      <MemoryRouter>
        <RepoLink name="openedx/edx-platform" />
      </MemoryRouter>,
    );
    const link = screen.getByRole("link", { name: "openedx/edx-platform" });
    expect(link).toHaveAttribute("href", "/repo_detail?repo=openedx%2Fedx-platform");
    expect(link).toHaveTextContent(/^openedx\/edx-platform$/);
  });
});
