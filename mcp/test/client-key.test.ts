import { describe, expect, it } from "vitest";
import { clientKeyFromAddress } from "../src/client-key.ts";

describe("clientKeyFromAddress", () => {
  it("returns unknown when the header is missing or empty", () => {
    expect(clientKeyFromAddress(null)).toBe("unknown");
    expect(clientKeyFromAddress("")).toBe("unknown");
  });

  it("leaves IPv4 unchanged", () => {
    expect(clientKeyFromAddress("203.0.113.7")).toBe("203.0.113.7");
  });

  it("collapses full IPv6 addresses to their /64", () => {
    expect(clientKeyFromAddress("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
  });

  it("gives hosts in one /64 the same key", () => {
    expect(clientKeyFromAddress("2001:db8:1:2::1")).toBe(clientKeyFromAddress("2001:db8:1:2:ffff::9"));
  });

  it("separates different /64 prefixes", () => {
    expect(clientKeyFromAddress("2001:db8:1:2::1")).not.toBe(clientKeyFromAddress("2001:db8:1:3::1"));
  });

  it("expands compressed forms", () => {
    expect(clientKeyFromAddress("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientKeyFromAddress("::1")).toBe("0:0:0:0::/64");
    expect(clientKeyFromAddress("::")).toBe("0:0:0:0::/64");
    expect(clientKeyFromAddress("2001:db8:1:2:3:4:5::")).toBe("2001:db8:1:2::/64");
    expect(clientKeyFromAddress("fe80::")).toBe("fe80:0:0:0::/64");
  });

  it("normalises case and leading zeros", () => {
    expect(clientKeyFromAddress("2001:0DB8:0001:0002::1")).toBe("2001:db8:1:2::/64");
  });

  it("maps IPv4-mapped addresses back to the IPv4 address", () => {
    expect(clientKeyFromAddress("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(clientKeyFromAddress("::FFFF:cb00:7107")).toBe("203.0.113.7");
  });

  it("ignores zone ids and brackets", () => {
    expect(clientKeyFromAddress("[2001:db8:1:2::1]")).toBe("2001:db8:1:2::/64");
    expect(clientKeyFromAddress("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("keeps malformed input as-is", () => {
    expect(clientKeyFromAddress("1:2:3::4::5")).toBe("1:2:3::4::5");
    expect(clientKeyFromAddress("zzzz::1")).toBe("zzzz::1");
  });
});
