import { describe, expect, it } from "vitest";
import type { FleetManifest } from "./schemas";
import { SIGNAL_CATALOGUE } from "./signals";
import { createConfigUrl, editConfigUrl, failedCount, proposalYaml, settingsText, signalState, statusesUsing, surfacesText } from "./signalsPanel";
import { isShownBy } from "./visibility";

function manifest(signals: FleetManifest["signals"]): FleetManifest {
  return { signals, statuses: [{ key: "ok", label: "OK" }, { key: "bad", label: "Bad", on_severe_advisory: true }] };
}

const shown = { collect: true, show: ["card", "detail"], tier: "api", cadence: "daily", thresholds: ["on_severe_advisory"], settings: { severe: ["high"] } };
const quiet = { ...shown, show: [] };
const off = { ...shown, collect: false, show: [] };

describe("isShownBy", () => {
  it("shows a collected signal only on its listed surfaces, and nothing the viewer hid", () => {
    const m = manifest({ advisories: shown });
    expect(isShownBy(m, new Set(), "advisories", "card")).toBe(true);
    expect(isShownBy(m, new Set(), "advisories", "table")).toBe(false);
    expect(isShownBy(m, new Set(["advisories"]), "advisories", "card")).toBe(false);
    expect(isShownBy(manifest({ advisories: shown, ci: shown }), new Set(["ci"]), "advisories", "card")).toBe(true);
    expect(isShownBy(m, new Set(), "ci", "detail")).toBe(false);
  });

  it("shows everything when there is no manifest, whatever the viewer hid before", () => {
    expect(isShownBy(null, new Set(), "ci", "detail")).toBe(true);
    expect(isShownBy(null, new Set(["ci"]), "ci", "detail")).toBe(true);
  });
});

describe("signal panel helpers", () => {
  it("names the state of a signal", () => {
    const m = manifest({ advisories: shown, ci: quiet, maintainers: off });
    expect(signalState(m, new Set(), "advisories")).toBe("shown");
    expect(signalState(m, new Set(["advisories"]), "advisories")).toBe("hidden_by_viewer");
    expect(signalState(m, new Set(), "ci")).toBe("not_shown");
    expect(signalState(m, new Set(), "maintainers")).toBe("off");
  });

  it("describes surfaces, settings and the statuses a signal can decide", () => {
    expect(surfacesText(["card", "overview_tile"])).toBe("fork cards, overview");
    expect(settingsText({ quiet_days: 120, severe: ["critical", "high"] })).toEqual(["quiet days: 120", "severe: critical, high"]);
    expect(statusesUsing(manifest({}).statuses, ["on_severe_advisory"])).toEqual(["Bad"]);
  });

  it("counts failures from null fields, never from a promotion that does not apply", () => {
    const ci = SIGNAL_CATALOGUE.find((info) => info.key === "ci")!;
    const promotion = SIGNAL_CATALOGUE.find((info) => info.key === "promotion")!;
    const records = [{ ci: null, promotion: null }, { ci: { state: "passing", total: 1 } }, {}] as never[];
    expect(failedCount(ci, records, {})).toBe(1);
    expect(failedCount(promotion, records, {})).toBe(0);
  });

  it("counts weekly failures from that signal's own view", () => {
    const carried = SIGNAL_CATALOGUE.find((info) => info.key === "carried_patches")!;
    const weekly = { carried_patches: { records: [{ error: "clone failed" }, {}] } };
    expect(failedCount(carried, [], weekly)).toBe(1);
    expect(failedCount(carried, [], { carried_patches: null })).toBe(0);
  });

  it("proposes the opposite of the current setting as lines to merge under signals:", () => {
    expect(proposalYaml("ci", true)).toBe("ci:\n  collect: false\n");
    expect(proposalYaml("ci", false)).toBe("ci:\n  collect: true\n");
  });

  it("links to editing the tenant's fleet.yaml, or creating it", () => {
    expect(editConfigUrl("https://github.com/o/r/", "acme")).toBe("https://github.com/o/r/edit/main/dashboard/config/acme/fleet.yaml");
    expect(createConfigUrl("https://github.com/o/r", "acme")).toBe("https://github.com/o/r/new/main/dashboard/config/acme?filename=fleet.yaml&value=signals%3A%0A");
  });
});
