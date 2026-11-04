const UNKNOWN_CLIENT = "unknown";
const IPV6_GROUP_COUNT = 8;
const PREFIX_GROUP_COUNT = 4;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV4_MAPPED_PATTERN = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const IPV4_MAPPED_HEX_PATTERN = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i;

function hexPairToIpv4(high: string, low: string): string {
  const value = (Number.parseInt(high, 16) << 16) | Number.parseInt(low, 16);
  return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

function embeddedIpv4(address: string): string | null {
  const dotted = IPV4_MAPPED_PATTERN.exec(address);
  if (dotted) return dotted[1] ?? null;
  const hex = IPV4_MAPPED_HEX_PATTERN.exec(address);
  return hex ? hexPairToIpv4(hex[1] ?? "0", hex[2] ?? "0") : null;
}

function splitGroups(part: string): string[] {
  return part === "" ? [] : part.split(":");
}

function expandIpv6(address: string): string[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = splitGroups(halves[0] ?? "");
  const tail = splitGroups(halves[1] ?? "");
  if (halves.length === 1) return head.length === IPV6_GROUP_COUNT ? head : null;
  const missing = IPV6_GROUP_COUNT - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...Array<string>(missing).fill("0"), ...tail];
}

function isValidGroup(group: string): boolean {
  return /^[0-9a-f]{1,4}$/i.test(group);
}

function ipv6Prefix(address: string): string | null {
  const groups = expandIpv6(address);
  if (!groups || !groups.every(isValidGroup)) return null;
  const prefix = groups.slice(0, PREFIX_GROUP_COUNT).map((group) => Number.parseInt(group, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

function stripZoneAndBrackets(raw: string): string {
  return raw.trim().replace(/^\[|\]$/g, "").split("%")[0] ?? "";
}

export function clientKeyFromAddress(raw: string | null): string {
  if (!raw) return UNKNOWN_CLIENT;
  const address = stripZoneAndBrackets(raw);
  if (IPV4_PATTERN.test(address)) return address;
  if (!address.includes(":")) return address === "" ? UNKNOWN_CLIENT : address;
  const mapped = embeddedIpv4(address);
  if (mapped) return mapped;
  return ipv6Prefix(address) ?? address;
}
