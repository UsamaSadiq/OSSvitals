import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { SupportProduct, SupportWindowView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

const EDIT_URL = "https://github.com/openedx/repo-tools/edit/master/barcalendar.py";

function product(overrides: Partial<SupportProduct>): SupportProduct {
  return {
    product: "node",
    label: "Node",
    source_note: "https://endoflife.date/nodejs",
    declared: "24",
    declared_kind: "declared",
    detected: "24",
    detected_url: "https://github.com/overhangio/tutor/blob/v22.0.3/tutor/templates/build/openedx/Dockerfile",
    current: "24",
    current_end: "2028-04-30",
    status: "ok",
    reason: "",
    cycles: [
      { cycle: "22", start: "2024-04-24", end: "2027-04-30", lts: true, current: false },
      { cycle: "24", start: "2025-05-06", end: "2028-04-30", lts: true, current: true },
    ],
    ...overrides,
  };
}

const PRODUCTS: SupportProduct[] = [
  product({}),
  product({
    product: "python",
    label: "Python",
    source_note: "https://endoflife.date/python",
    declared: "3.11",
    detected: "3.12",
    current: "3.12",
    status: "drift",
    reason: "barcalendar.py declares 3.11; overhangio/tutor v22.0.3 ships 3.12",
    cycles: [{ cycle: "3.12", start: "2023-10-02", end: "2028-10-31", lts: false, current: true }],
  }),
  product({
    product: "redis",
    label: "Redis",
    declared: null,
    declared_kind: "follows_tutor",
    detected: "7.4",
    detected_url: null,
    status: "eol",
    reason: "7.4 reached end of life in January 2026",
    cycles: [{ cycle: "8.10", start: "2026-07-29", end: null, lts: false, current: false }],
  }),
];

function snapshot(overrides: Partial<SupportWindowView> = {}): SupportWindowView {
  return {
    metadata: metadata("endoflife.date, Tutor release files and repo-tools barcalendar.py"),
    available: true,
    collected_at: "2026-10-31T08:53:00+00:00",
    declared_url: "https://github.com/openedx/repo-tools/blob/master/barcalendar.py",
    edit_url: EDIT_URL,
    refs: { tutor: { repo: "overhangio/tutor", ref: "v22.0.3" } },
    window: { years_back: 3, years_ahead: 4 },
    summary: { drift: 1, eol: 1, eol_soon: 0, ok: 1, unknown: 0 },
    products: PRODUCTS,
    ...overrides,
  };
}

function setView(view: SupportWindowView) {
  views.current = { support_window: ready(view) };
}

beforeEach(() => setView(snapshot()));

describe("Support Window page", () => {
  it("shows the info empty state before the collector has published", async () => {
    setView({ metadata: metadata("x"), available: false });
    renderRoute("/support_window");

    expect(await screen.findByText("No support window snapshot yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Products" })).not.toBeInTheDocument();
  });

  it("renders the sources caption and status tiles", async () => {
    renderRoute("/support_window");

    expect(await screen.findByRole("heading", { level: 1, name: "Support Window" })).toBeInTheDocument();
    expect(document.title).toBe("Support Window · Open edX Repo Health");
    const caption = screen.getByRole("link", { name: "barcalendar.py" }).closest("p");
    expect(caption).toHaveTextContent(
      "Collected 2026-10-31 from overhangio/tutor v22.0.3. Declared versions from barcalendar.py.",
    );
    expect(screen.getByRole("group", { name: "Calendar out of date" })).toHaveTextContent("1");
    expect(screen.getByRole("group", { name: "Past end of life" })).toHaveTextContent("1");
    expect(screen.getByRole("group", { name: "Up to date" })).toHaveTextContent("1");
  });

  it("asks for a barcalendar.py pull request when a product drifted", async () => {
    renderRoute("/support_window");

    const notice = (await screen.findByText("barcalendar.py needs a pull request for Python.")).closest(".empty-state");
    expect(notice).toHaveClass("empty-state--warn");
    expect(notice).toHaveTextContent("barcalendar.py declares 3.11; overhangio/tutor v22.0.3 ships 3.12");
    expect(within(notice as HTMLElement).getByRole("link", { name: "Edit barcalendar.py" })).toHaveAttribute("href", EDIT_URL);
  });

  it("says the calendar matches when nothing drifted", async () => {
    setView(snapshot({ products: [product({})], summary: { drift: 0, eol: 0, eol_soon: 0, ok: 1, unknown: 0 } }));
    renderRoute("/support_window");

    expect(await screen.findByText("barcalendar.py matches what Tutor ships.")).toBeInTheDocument();
  });

  it("lists products worst first with how each version is declared", async () => {
    renderRoute("/support_window");

    const table = await screen.findByRole("table", { name: "Products" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0]!.textContent)).toEqual(["Python", "Redis", "Node"]);
    expect(rows[1]).toHaveTextContent("Follows Tutor");
    expect(within(rows[2]!).getByRole("link", { name: "24" })).toHaveAttribute(
      "href",
      "https://github.com/overhangio/tutor/blob/v22.0.3/tutor/templates/build/openedx/Dockerfile",
    );
  });

  it("draws each cycle with an accessible label and marks the one in use", async () => {
    renderRoute("/support_window");

    const node = await screen.findByRole("list", { name: "Node release cycles" });
    const current = within(node).getByRole("listitem", { name: "Node 24, May 2025 to Apr 2028, in use" });
    expect(current.querySelector(".sw-bar")).toHaveClass("sw-bar--current", "sw-bar--ok");
    const open = screen.getByRole("listitem", { name: "Redis 8.10, Jul 2026 to no end date published" });
    expect(open.querySelector(".sw-bar")).toHaveClass("sw-bar--open");
  });
});
