import { publicTenants } from "../src/tenants.ts";

describe("publicTenants", () => {
  it("drops private tenants, whose data never reaches the public data host", () => {
    const all = {
      openedx: { kind: "health", site: "https://openedx.ossvitals.org" },
      moneta: { kind: "fleet", site: "https://moneta.ossvitals.org", visibility: "public" },
      edly: { kind: "fleet", site: "https://edly.ossvitals.org", visibility: "private" },
    } as const;
    expect(Object.keys(publicTenants(all))).toEqual(["openedx", "moneta"]);
  });
});
