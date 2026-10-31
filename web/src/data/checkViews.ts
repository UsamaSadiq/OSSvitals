import { FLEET_VIEWS } from "../kinds/fleet/schemas.ts";
import { parseView } from "./parse.ts";
import { VIEW_NAMES, viewFileName } from "./schemas.ts";

export type TenantKind = "health" | "fleet";
export type ReadView = (file: string) => Promise<unknown | undefined>;
export type ViewCheck = { file: string; outcome: "ok" | "absent" | "fail"; message?: string };

interface Check {
  file: string;
  required: boolean;
  parse: (raw: unknown) => unknown;
}

const HEALTH_CHECKS: Check[] = VIEW_NAMES.map((name) => ({ file: viewFileName(name), required: true, parse: (raw) => parseView(name, raw) }));

const FLEET_CHECKS: Check[] = Object.values(FLEET_VIEWS).map(({ file, schema, required }) => ({ file, required, parse: (raw) => schema.parse(raw) }));

const CHECKS: Record<TenantKind, Check[]> = { health: HEALTH_CHECKS, fleet: FLEET_CHECKS };

function failure(file: string, error: unknown): ViewCheck {
  const message = error instanceof Error ? error.message : String(error);
  return { file, outcome: "fail", message: message.startsWith(`${file}:`) ? message : `${file}: ${message}` };
}

async function runCheck(check: Check, read: ReadView): Promise<ViewCheck> {
  try {
    const raw = await read(check.file);
    if (raw === undefined) return check.required ? failure(check.file, "missing") : { file: check.file, outcome: "absent" };
    check.parse(raw);
    return { file: check.file, outcome: "ok" };
  } catch (error) {
    return failure(check.file, error);
  }
}

/** Checks every view a tenant of this kind publishes; a fleet view the tenant does not collect may be absent. */
export function checkViews(kind: TenantKind, read: ReadView): Promise<ViewCheck[]> {
  return Promise.all(CHECKS[kind].map((check) => runCheck(check, read)));
}
