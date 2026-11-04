import { z } from "zod";

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

export function isHttpUrl(value: string): boolean {
  try {
    return WEB_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}

function webUrlOrNull(value: string): string | null {
  return isHttpUrl(value) ? value : null;
}

export const httpUrl = z.string().transform(webUrlOrNull);

export const optionalHttpUrl = httpUrl.nullish();
