import { z } from "zod";
import { SCHEMA_VERSION, VIEW_SCHEMAS, viewFileName, type View, type ViewName } from "./schemas.ts";

export type ViewErrorKind = "network" | "http" | "json" | "schema_version" | "schema";

export class ViewDataError extends Error {
  readonly file: string;
  readonly kind: ViewErrorKind;

  constructor(file: string, kind: ViewErrorKind, detail: string) {
    super(`${file}: ${detail}`);
    this.name = "ViewDataError";
    this.file = file;
    this.kind = kind;
  }
}

function schemaVersionOf(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return undefined;
  const metadata = (raw as { metadata?: unknown }).metadata;
  if (typeof metadata !== "object" || metadata === null) return undefined;
  return (metadata as { schema_version?: unknown }).schema_version;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    .join("; ");
}

export function parseView<Name extends ViewName>(name: Name, raw: unknown): View<Name> {
  const file = viewFileName(name);
  const version = schemaVersionOf(raw);
  if (version !== SCHEMA_VERSION) {
    throw new ViewDataError(file, "schema_version", `schema_version ${String(version)}, expected ${SCHEMA_VERSION}`);
  }
  const result = VIEW_SCHEMAS[name].safeParse(raw);
  if (!result.success) {
    throw new ViewDataError(file, "schema", `does not match the expected shape (${describeIssues(result.error)})`);
  }
  return result.data as View<Name>;
}
