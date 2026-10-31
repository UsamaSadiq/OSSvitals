import { describe, expect, it } from "vitest";
import type { FleetManifest } from "./schemas";
import { SIGNAL_CATALOGUE } from "./signals";
import { failedCount, proposalYaml, settingsText, signalState, statusesUsing, surfacesText } from "./signalsPanel";
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
    expect(isShownBy(m, new Set(), "ci", "detail")).toBe(false);
  });

  it("shows everything the viewer did not hide when there is no manifest", () => {
    expect(isShownBy(null, new Set(), "ci", "detail")).toBe(true);
    expect(isShownBy(null, new Set(["ci"]), "ci", "detail")).toBe(false);
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
    expect(failedCount(ci, records, null)).toBe(1);
    expect(failedCount(promotion, records, null)).toBe(0);
  });

  it("proposes the opposite of the current collection setting", () => {
    expect(proposalYaml("ci", true)).toBe("signals:\n  ci:\n    collect: false\n");
    expect(proposalYaml("ci", false)).toContain("collect: true");
  });
});
