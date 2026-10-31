import { z } from "zod";
import { FLEET_VIEWS } from "../kinds/fleet/schemas.ts";
import { parseView } from "./parse.ts";
import { VIEW_NAMES, viewFileName } from "./schemas.ts";

export type TenantKind = "health" | "fleet";
export type ReadView = (file: string) => Promise<unknown | undefined>;
export type ViewCheck = { file: string; required: boolean; outcome: "ok" | "absent" | "fail"; message?: string };

interface Check {
  file: string;
  required: boolean;
  parse: (raw: unknown) => unknown;
}

const HEALTH_CHECKS: Check[] = VIEW_NAMES.map((name) => ({ file: viewFileName(name), required: true, parse: (raw) => parseView(name, raw) }));

const SITE_META = "meta.json";

/** Every tenant's meta.json must also pass the shared site check, which decides whether the data host is trusted. */
function fleetCheck({ file, schema, required }: { file: string; schema: { parse: (raw: unknown) => unknown }; required: boolean }): Check {
  if (file !== SITE_META) return { file, required, parse: (raw) => schema.parse(raw) };
  return { file, required: true, parse: (raw) => [parseView("meta", raw), schema.parse(raw)] };
}

const FLEET_CHECKS: Check[] = Object.values(FLEET_VIEWS).map(fleetCheck);

const CHECKS: Record<TenantKind, Check[]> = { health: HEALTH_CHECKS, fleet: FLEET_CHECKS };

function describe(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("; ");
  return error instanceof Error ? error.message : String(error);
}

function failure({ file, required }: Check, error: unknown): ViewCheck {
  const message = describe(error);
  return { file, required, outcome: "fail", message: message.startsWith(`${file}:`) ? message : `${file}: ${message}` };
}

async function runCheck(check: Check, read: ReadView): Promise<ViewCheck> {
  try {
    const raw = await read(check.file);
    if (raw === undefined) return check.required ? failure(check, "missing") : { file: check.file, required: false, outcome: "absent" };
    check.parse(raw);
    return { file: check.file, required: check.required, outcome: "ok" };
  } catch (error) {
    return failure(check, error);
  }
}

/** Checks every view a tenant of this kind publishes; a fleet view the tenant does not collect may be absent. */
export function checkViews(kind: TenantKind, read: ReadView): Promise<ViewCheck[]> {
  return Promise.all(CHECKS[kind].map((check) => runCheck(check, read)));
}
