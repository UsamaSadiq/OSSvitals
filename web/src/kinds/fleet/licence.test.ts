import { describe, expect, it } from "vitest";
import { licenceHistoryUrl, licenceNotice } from "./licence";

const base = { present: true, path: "LICENSE", sha: "s", spdx: "MIT", declared: "MIT", matches_declared: true, changed_on: null, previous_spdx: null, previous_present: null };

describe("licenceNotice", () => {
  it("says nothing when the file is unchanged and matches what we list", () => {
    expect(licenceNotice(base)).toBeNull();
    expect(licenceNotice(undefined)).toBeNull();
  });

  it("says the file changed, and whether the licence it names did", () => {
    expect(licenceNotice({ ...base, changed_on: "2026-10-30", previous_spdx: "MIT" })).toBe("Upstream's licence file changed on 2026-10-30, still MIT");
    expect(licenceNotice({ ...base, spdx: "BUSL-1.1", changed_on: "2026-10-30", previous_spdx: "Apache-2.0" })).toBe(
      "Upstream's licence file changed on 2026-10-30, Apache-2.0 → BUSL-1.1",
    );
    expect(licenceNotice({ ...base, spdx: null, changed_on: "2026-10-30", previous_spdx: "MIT" })).toBe("Upstream's licence file changed on 2026-10-30");
  });

  it("flags a removed or missing file and a licence that differs from ours", () => {
    expect(licenceNotice({ ...base, present: false, changed_on: "2026-10-30" })).toBe("Upstream removed its licence file on 2026-10-30");
    expect(licenceNotice({ ...base, present: false })).toBe("Upstream has no licence file");
    expect(licenceNotice({ ...base, spdx: "Apache-2.0", matches_declared: false })).toBe("Upstream's licence is Apache-2.0; we list MIT");
  });

  it("calls a file that did not exist before added, and keeps a licence difference visible during a change", () => {
    expect(licenceNotice({ ...base, changed_on: "2026-10-30", previous_present: false })).toBe("Upstream added a licence file on 2026-10-30");
    expect(licenceNotice({ ...base, declared: "Apache-2.0", matches_declared: false, changed_on: "2026-10-30", previous_spdx: "MIT" })).toBe(
      "Upstream's licence file changed on 2026-10-30, still MIT. Upstream's licence is MIT; we list Apache-2.0",
    );
  });

  it("links to the file's history on the branch we track", () => {
    expect(licenceHistoryUrl("https://github.com/up/demo", "release/7.x", "docs/LICENSE.txt")).toBe(
      "https://github.com/up/demo/commits/release%2F7.x/docs/LICENSE.txt",
    );
  });
});
