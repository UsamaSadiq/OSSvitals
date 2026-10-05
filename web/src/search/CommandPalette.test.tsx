import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../data/fixtures";
import { renderRoute, withMaintainerViews } from "../test/renderRoute";
import { checkPath, failingCheckPath, searchSections, pageItems } from "./paletteItems";
import { isSlashOpen, nextIndex } from "./paletteKeys";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown>, requested: [] as string[] }));

vi.mock("../data/useView", () => ({
  useView: (name: string) => {
    views.requested.push(name);
    return views.current[name] ?? { status: "loading", data: undefined, error: undefined };
  },
}));

function ready(data: unknown) {
  return { status: "ready", data, error: undefined };
}

function repo(repo_name: string, score_letter: string, score_composite: number) {
  return { repo_name, score_letter, score_composite, checks: {}, category_stats: {}, owner_handles: [] };
}

function check(name: string, title: string) {
  return {
    check: name,
    title,
    category: null,
    description: null,
    populated_pct: 100,
    pass_pct: 50,
    scored_by: null,
    has_remediation: false,
    remediation: null,
    pr_template: null,
  };
}

function owner(name: string, owner_key: string) {
  return { owner: name, owner_type: "group", owner_key, repo_count: 2, avg_score: 50, d_or_f: 0, at_risk: 0 };
}

function setSearchData() {
  views.current = {
    repos: ready({
      metadata: metadata("repos"),
      records: [repo("openedx/edx-platform", "C", 55.25), repo("openedx/frontend-app-learning", "A", 88), repo("openedx/xblock", "B", 70)],
    }),
    checks: ready({
      metadata: metadata("checks"),
      records: [check("dependabot.exists", "Dependabot config"), check("exists.README.rst", "README present")],
    }),
    failing_checks: ready({ metadata: metadata("failing_checks"), records: [{ check: "dependabot.exists", failing: 4 }] }),
    owners: ready({ metadata: metadata("owners"), records: [owner("group:rg-mobile", "rg-mobile")] }),
  };
}

beforeEach(() => {
  views.current = {};
  views.requested = [];
});

async function openPalette() {
  await userEvent.click(within(await screen.findByRole("banner")).getByRole("button", { name: "Search" }));
  return screen.getByRole("dialog", { name: "Search" });
}

function optionNames(): string[] {
  return screen.getAllByRole("option").map((option) => option.textContent ?? "");
}

describe("command palette shortcuts", () => {
  it("opens with Ctrl+K and Cmd+K and closes with Escape, restoring focus", async () => {
    renderRoute("/");
    const button = within(await screen.findByRole("banner")).getByRole("button", { name: "Search" });
    button.focus();

    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await userEvent.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
  });

  it("opens with / outside text fields", async () => {
    renderRoute("/");
    await screen.findByRole("banner");
    await userEvent.keyboard("/");
    expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("");
  });

  it("ignores / typed inside an input", () => {
    const input = document.createElement("input");
    const checkbox = Object.assign(document.createElement("input"), { type: "checkbox" });
    const textarea = document.createElement("textarea");
    expect(isSlashOpen(new KeyboardEvent("keydown", { key: "/" }))).toBe(true);
    for (const target of [input, textarea]) {
      const event = new KeyboardEvent("keydown", { key: "/", bubbles: true });
      Object.defineProperty(event, "target", { value: target });
      expect(isSlashOpen(event)).toBe(false);
    }
    const onCheckbox = new KeyboardEvent("keydown", { key: "/" });
    Object.defineProperty(onCheckbox, "target", { value: checkbox });
    expect(isSlashOpen(onCheckbox)).toBe(true);
  });

  it("does not open when / is typed into a page field", async () => {
    renderRoute("/");
    await screen.findByRole("banner");
    const field = document.body.appendChild(Object.assign(document.createElement("input"), { type: "search" }));
    await userEvent.type(field, "a/b");
    expect(field).toHaveValue("a/b");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    field.remove();
  });
});

describe("command palette dialog", () => {
  it("is a labelled modal dialog with a combobox controlling a listbox", async () => {
    renderRoute("/");
    const dialog = await openPalette();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const input = within(dialog).getByRole("combobox");
    expect(input).toHaveAttribute("aria-controls", within(dialog).getByRole("listbox").id);
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0]?.id);
  });

  it("lists the pages before anything is typed and loads search data lazily", async () => {
    renderRoute("/", withMaintainerViews(false));
    await screen.findByRole("banner");
    expect(views.requested).not.toContain("checks");

    await openPalette();
    expect(views.requested).toEqual(expect.arrayContaining(["repos", "checks", "failing_checks"]));
    expect(views.requested).not.toContain("owners");
    expect(optionNames()).toContain("Overview");
    expect(optionNames()).not.toContain("At Risk");
    expect(screen.getByText("Loading repositories, checks and owners…")).toBeInTheDocument();
  });

  it("searches repositories, checks and owners", async () => {
    setSearchData();
    renderRoute("/", withMaintainerViews(true));
    await openPalette();

    await userEvent.type(screen.getByRole("combobox"), "edx");
    const repos = screen.getByRole("group", { name: "Repositories" });
    expect(within(repos).getAllByRole("option")[0]).toHaveTextContent("openedx/edx-platform55.2");
    expect(within(repos).getAllByRole("option")[0]).toContainElement(screen.getAllByRole("img", { name: "Grade C" })[0] ?? null);

    await userEvent.clear(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "mobile");
    expect(within(screen.getByRole("group", { name: "Owners" })).getByRole("option")).toHaveTextContent("group:rg-mobile");

    await userEvent.clear(screen.getByRole("combobox"));
    await userEvent.type(screen.getByRole("combobox"), "readme");
    expect(within(screen.getByRole("group", { name: "Checks" })).getByRole("option")).toHaveTextContent("README presentexists.README.rst");
  });

  it("announces the number of results", async () => {
    setSearchData();
    renderRoute("/");
    await openPalette();
    await userEvent.type(screen.getByRole("combobox"), "openedx/xblock");
    expect(within(screen.getByRole("dialog")).getByRole("status")).toHaveTextContent("1 result");
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(within(screen.getByRole("dialog")).getByRole("status")).toHaveTextContent("0 results");
    expect(screen.getByText("No matches for “openedx/xblockzzz”.")).toBeInTheDocument();
  });

  it("moves through results across sections with the arrow keys and wraps", async () => {
    setSearchData();
    renderRoute("/");
    await openPalette();
    const input = screen.getByRole("combobox");
    await userEvent.type(input, "e");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}");
    expect(input).toHaveAttribute("aria-activedescendant", options[1]?.id);
    await userEvent.keyboard("{ArrowUp}{ArrowUp}");
    expect(input).toHaveAttribute("aria-activedescendant", options.at(-1)?.id);
  });

  it("opens a repository on Enter and moves focus to the main content", async () => {
    setSearchData();
    renderRoute("/");
    await openPalette();
    await userEvent.type(screen.getByRole("combobox"), "xblock{Enter}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Repository Detail" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("opens a page from a click", async () => {
    setSearchData();
    renderRoute("/", withMaintainerViews(true));
    await openPalette();
    await userEvent.type(screen.getByRole("combobox"), "scoring");
    await userEvent.click(screen.getByRole("option", { name: "How Scoring Works" }));
    expect(await screen.findByRole("heading", { level: 1, name: "How Scoring Works" })).toBeInTheDocument();
  });

  it("keeps Tab inside the dialog", async () => {
    renderRoute("/");
    await openPalette();
    const input = screen.getByRole("combobox");
    const close = screen.getByRole("button", { name: "Close search" });
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(input).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(close).toHaveFocus();
  });

  it("closes from the close button and the backdrop", async () => {
    renderRoute("/");
    await openPalette();
    await userEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await openPalette();
    await userEvent.click(dialog.parentElement as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("palette helpers", () => {
  it("sends failing checks to Failing Checks and the rest to the catalog", () => {
    const failing = new Set(["dependabot.exists"]);
    expect(checkPath("dependabot.exists", failing)).toBe(failingCheckPath("dependabot.exists"));
    expect(failingCheckPath("dependabot.exists")).toBe("/failing_checks?category=dependabot.exists");
    expect(checkPath("exists.README.rst", failing)).toBe("/glossary");
  });

  it("drops empty sections", () => {
    const sections = searchSections({ pages: pageItems([{ path: "/", title: "Overview" }]), repos: [] }, "over");
    expect(sections.map((section) => section.title)).toEqual(["Pages"]);
  });

  it("steps and wraps through a list", () => {
    expect(nextIndex(0, 3, 1)).toBe(1);
    expect(nextIndex(2, 3, 1)).toBe(0);
    expect(nextIndex(0, 3, -1)).toBe(2);
    expect(nextIndex(-1, 0, 1)).toBe(-1);
  });
});
