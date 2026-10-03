import { describe, expect, it } from "vitest";
import { resolveOrg } from "./org";

describe("resolveOrg", () => {
  it.each([
    ["openedx.ossvitals.org", "openedx"],
    ["next.ossvitals.org", "openedx"],
    ["edly.ossvitals.org", "edly"],
    ["EDLY.OSSVitals.org", "edly"],
  ])("maps %s to %s", (hostname, org) => {
    expect(resolveOrg(hostname)).toBe(org);
  });

  it.each(["localhost", "127.0.0.1", "ossvitals.org", "a.b.ossvitals.org", "ossvitals.example.workers.dev"])(
    "falls back to the default org for %s",
    (hostname) => {
      expect(resolveOrg(hostname)).toBe("openedx");
      expect(resolveOrg(hostname, "edly")).toBe("edly");
    },
  );
});
