import { describe, expect, it } from "vitest";
import { formatAge, formatDelta, formatNumber, formatPercent, formatScore, formatUtcDate, NO_CHANGE, percentOf, toFixedHalfEven } from ".";

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("rounds to the requested decimals", () => {
    expect(formatNumber(1234.567, 1)).toBe("1,234.6");
  });
});

describe("formatScore", () => {
  it("shows one decimal", () => {
    expect(formatScore(72)).toBe("72.0");
    expect(formatScore(72.46)).toBe("72.5");
  });
});

describe("formatPercent", () => {
  it("formats a fraction as a whole percent by default", () => {
    expect(formatPercent(0.834)).toBe("83%");
  });

  it("honours decimals", () => {
    expect(formatPercent(0.8345, 1)).toBe("83.5%");
  });

  it("rounds exact halves to even like Python", () => {
    expect(formatPercent(0.125)).toBe("12%");
    expect(formatPercent(21 / 168)).toBe("12%");
    expect(formatPercent(0.135)).toBe("14%");
  });
});

describe("toFixedHalfEven", () => {
  it("rounds exact ties to the even neighbour", () => {
    expect(toFixedHalfEven(12.5)).toBe("12");
    expect(toFixedHalfEven(13.5)).toBe("14");
    expect(toFixedHalfEven(0.5)).toBe("0");
    expect(toFixedHalfEven(-12.5)).toBe("-12");
  });

  it("rounds non-ties to nearest", () => {
    expect(toFixedHalfEven(12.4)).toBe("12");
    expect(toFixedHalfEven(12.6)).toBe("13");
    expect(toFixedHalfEven(0.125, 2)).toBe("0.12");
  });
});

describe("percentOf", () => {
  it("returns the share of a total as a percentage", () => {
    expect(percentOf(62, 248)).toBe(25);
  });

  it("returns 0 for an empty total", () => {
    expect(percentOf(3, 0)).toBe(0);
  });
});

describe("formatDelta", () => {
  it("returns null when there is no baseline", () => {
    expect(formatDelta(null, "int")).toBeNull();
    expect(formatDelta(undefined, "float")).toBeNull();
  });

  it("reports an int zero as no change", () => {
    expect(formatDelta(0, "int")).toBe(NO_CHANGE);
  });

  it("reports a float below 0.05 in magnitude as no change", () => {
    expect(formatDelta(0.049, "float")).toBe(NO_CHANGE);
    expect(formatDelta(-0.04, "float")).toBe(NO_CHANGE);
    expect(formatDelta(0, "float")).toBe(NO_CHANGE);
  });

  it("signs a float with one decimal", () => {
    expect(formatDelta(-0.31, "float")).toBe("-0.3");
    expect(formatDelta(1.26, "float")).toBe("+1.3");
  });

  it("keeps the decimal for a whole-number float", () => {
    expect(formatDelta(3, "float")).toBe("+3.0");
  });

  it("signs an int", () => {
    expect(formatDelta(3, "int")).toBe("+3");
    expect(formatDelta(-2, "int")).toBe("-2");
  });
});

describe("formatUtcDate", () => {
  it("uses the UTC calendar date", () => {
    expect(formatUtcDate("2026-10-01T23:30:00-05:00")).toBe("2026-10-02");
    expect(formatUtcDate(new Date(Date.UTC(2026, 0, 5, 1)))).toBe("2026-01-05");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatUtcDate("not a date")).toBe("");
  });
});

describe("formatAge", () => {
  it("uses hours under two days", () => {
    expect(formatAge(47)).toBe("47h");
  });

  it("uses whole days from two days", () => {
    expect(formatAge(48)).toBe("2 days");
    expect(formatAge(80)).toBe("3 days");
  });
});
