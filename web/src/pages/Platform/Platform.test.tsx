import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata } from "../../data/fixtures";
import type { Modularization, PlatformView, ViewName } from "../../data/schemas";
import type { ViewState } from "../../data/useView";
import { renderRoute } from "../../test/renderRoute";

const views = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../data/useView", () => ({
  useView: (name: string) => views.current[name] ?? { status: "loading", data: undefined, error: undefined },
}));

function ready<Name extends ViewName>(data: unknown): ViewState<Name> {
  return { status: "ready", data, error: undefined } as ViewState<Name>;
}

const TOGGLES_URL = "https://github.com/openedx/openedx-platform/blob/master/openedx/envs/common.py";

function modularization(overrides: Partial<Modularization> = {}): Modularization {
  return {
    available: true,
    collected_at: "2026-11-04T11:24:51+00:00",
    repo: "openedx/openedx-platform",
    ref: "master",
    toggles_url: TOGGLES_URL,
    extracted_package: "xblocks-contrib",
    pins: { "openedx-core": "1.21.0", "openedx-events": null },
    pins_url: "https://github.com/openedx/openedx-platform/blob/master/requirements/edx/base.txt",
    legacy_frontend: {
      history: [
        { date: "2020-01-01", count: 2500 },
        { date: "2026-01-01", count: 2200 },
        { date: "2026-11-04", count: 2000 },
      ],
    },
    summary: { blocks: 2, extracted: 1, percent_extracted: 50 },
    blocks: [
      { block: "Video", toggle: "VIDEO", status: "built_in" },
      { block: "Word Cloud", toggle: "WORD_CLOUD", status: "extracted" },
    ],
    ...overrides,
  };
}

function snapshot(overrides: Partial<PlatformView> = {}): PlatformView {
  return {
    metadata: metadata("openedx-platform source files and git history on GitHub"),
    available: true,
    modularization: modularization(),
    ...overrides,
  };
}

function setView(view: PlatformView) {
  views.current = { platform: ready(view) };
}

beforeEach(() => setView(snapshot()));

describe("Platform page", () => {
  it("shows the info empty state before any collector has published", async () => {
    setView(snapshot({ available: false, modularization: { available: false } }));
    renderRoute("/platform");

    expect(await screen.findByText("No platform snapshot yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Modularization" })).not.toBeInTheDocument();
  });

  it("summarises extraction and the legacy frontend trend", async () => {
    renderRoute("/platform");

    expect(await screen.findByRole("heading", { level: 1, name: "Platform" })).toBeInTheDocument();
    expect(document.title).toBe("Platform · Open edX Repo Health");
    expect(screen.getByRole("group", { name: "Built-in XBlocks extracted" })).toHaveTextContent("1 of 2");
    const legacy = screen.getByRole("group", { name: "Legacy frontend files" });
    expect(legacy).toHaveTextContent("2,000");
    expect(legacy).toHaveTextContent("down 20% since 2020");
    expect(screen.getByRole("link", { name: "openedx/envs/common.py" })).toHaveAttribute("href", TOGGLES_URL);
  });

  it("lists each block's status and every pinned package", async () => {
    renderRoute("/platform");

    const blocks = await screen.findByRole("table", { name: "Core XBlocks" });
    expect(within(blocks).getByRole("row", { name: /Video/ })).toHaveTextContent("Still built in");
    expect(within(blocks).getByRole("row", { name: /Word Cloud/ })).toHaveTextContent("USE_EXTRACTED_WORD_CLOUD_BLOCK");
    const pins = screen.getByRole("table", { name: "Extracted packages" });
    expect(within(pins).getByRole("row", { name: /openedx-events/ })).toHaveTextContent("Not pinned");
  });
});
