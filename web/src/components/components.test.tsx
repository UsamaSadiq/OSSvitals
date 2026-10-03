import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gauge, measuredCaveat } from "./Gauge";
import { DEFAULT_GAUGE_BANDS, gaugeBands, gaugeTicks } from "./gaugeBands";
import { arcPath, pointAt } from "./gaugeGeometry";
import { kpiDelta } from "./kpiDelta";
import { sortRows } from "./sortRows";

describe("kpiDelta", () => {
  it("is absent without a baseline", () => {
    expect(kpiDelta(null, "int")).toBeNull();
  });

  it("treats an increase as good unless inverse", () => {
    expect(kpiDelta(3, "int")).toEqual({ text: "+3", direction: "up", tone: "good" });
    expect(kpiDelta(3, "int", true)).toEqual({ text: "+3", direction: "up", tone: "bad" });
    expect(kpiDelta(-2, "int", true)).toEqual({ text: "-2", direction: "down", tone: "good" });
  });

  it("is neutral for no change", () => {
    expect(kpiDelta(0, "int")).toEqual({ text: "no change", direction: "flat", tone: "neutral" });
    expect(kpiDelta(0.04, "float")).toEqual({ text: "no change", direction: "flat", tone: "neutral" });
  });
});

describe("sortRows", () => {
  const rows = [
    { name: "b", score: 70 },
    { name: "c", score: 90 },
    { name: "a", score: 70 },
  ];

  it("returns a new sorted array and leaves the input alone", () => {
    const sorted = sortRows(rows, (row) => row.score, "descending", (x, y) => x.name.localeCompare(y.name));
    expect(sorted.map((row) => row.name)).toEqual(["c", "a", "b"]);
    expect(rows.map((row) => row.name)).toEqual(["b", "c", "a"]);
  });

  it("sorts text ascending", () => {
    expect(sortRows(rows, (row) => row.name, "ascending").map((row) => row.name)).toEqual(["a", "b", "c"]);
  });
});

describe("gauge geometry", () => {
  it("maps 0 to the left, 50 to the top and 100 to the right of the arc", () => {
    const center = { x: 0, y: 0 };
    expect(pointAt(0, 10, center).x).toBeCloseTo(-10);
    expect(pointAt(50, 10, center).y).toBeCloseTo(-10);
    expect(pointAt(100, 10, center).x).toBeCloseTo(10);
  });

  it("clamps out-of-range values", () => {
    expect(pointAt(140, 10)).toEqual(pointAt(100, 10));
  });

  it("draws an arc path", () => {
    expect(arcPath(0, 100, 10)).toBe("M 110 120 A 10 10 0 0 1 130 120");
  });
});

describe("Gauge", () => {
  it("shows the value, grade and the measured-weight caveat", () => {
    render(<Gauge value={71.459} letter="B" measuredWeight={0.5} />);
    expect(screen.getByRole("img", { name: "Org average score 71.5 out of 100, grade B, based on 50% of metric weight" })).toBeInTheDocument();
    expect(screen.getByText("71.5")).toBeInTheDocument();
    expect(screen.getByText("Grade B")).toBeInTheDocument();
    expect(screen.getByText("based on 50% of metric weight")).toBeInTheDocument();
  });

  it("omits the caveat when everything is measured", () => {
    expect(measuredCaveat(0.9995)).toBeNull();
    expect(measuredCaveat(undefined)).toBeNull();
  });
});

describe("gaugeBands", () => {
  const CONFIG_BANDS = [
    { grade: "A" as const, from: 85, to: 100 },
    { grade: "B" as const, from: 60, to: 84 },
    { grade: "C" as const, from: 40, to: 59 },
    { grade: "D" as const, from: 20, to: 39 },
    { grade: "F" as const, from: 0, to: 19 },
  ];

  it("closes the gaps between inclusive config bands in ascending order", () => {
    expect(gaugeBands(CONFIG_BANDS)).toEqual([
      { grade: "F", from: 0, to: 20 },
      { grade: "D", from: 20, to: 40 },
      { grade: "C", from: 40, to: 60 },
      { grade: "B", from: 60, to: 85 },
      { grade: "A", from: 85, to: 100 },
    ]);
  });

  it("falls back to the default bands when config has none", () => {
    expect(gaugeBands([])).toBe(DEFAULT_GAUGE_BANDS);
  });

  it("puts a tick on every band boundary", () => {
    expect(gaugeTicks(gaugeBands(CONFIG_BANDS))).toEqual([0, 20, 40, 60, 85, 100]);
  });

  it("draws the gauge ticks from the bands it is given", () => {
    render(<Gauge value={70} letter="B" bands={gaugeBands(CONFIG_BANDS)} />);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.queryByText("80")).not.toBeInTheDocument();
  });
});
