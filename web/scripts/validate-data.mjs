import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import tenants from "../../dashboard/config/tenants.json" with { type: "json" };
import { checkViews } from "../src/data/checkViews.ts";

const USAGE = `Usage: npm run validate-data -- [--org <org>] [--root <path> | --dir <path>]

Parses every view file of each tenant in dashboard/config/tenants.json with the
zod schemas of its kind (health: src/data/schemas.ts, fleet:
src/kinds/fleet/schemas.ts). Exits 1 if a required file is missing, or any file
is not JSON or does not match its schema. Optional fleet views may be absent.

  --org <org>   check one tenant (default: every tenant)
  --root <path> directory holding <org>/views (default: public/data)
  --dir <path>  directory holding the view files of the one --org tenant
  --help        show this message`;

function options() {
  const { values } = parseArgs({
    options: {
      org: { type: "string" },
      root: { type: "string" },
      dir: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  return values;
}

function reader(dir) {
  return async (file) => {
    try {
      return JSON.parse(await readFile(join(dir, file), "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return undefined;
      throw error;
    }
  };
}

const LABELS = { ok: "ok    ", absent: "absent", fail: "FAIL  " };

async function validateOrg(org, dir) {
  const kind = tenants[org]?.kind;
  if (!kind) throw new Error(`unknown tenant ${org}; add it to dashboard/config/tenants.json`);
  const results = await checkViews(kind, reader(dir));
  console.log(`Validating ${org} (${kind}) in ${dir}`);
  for (const result of results) console.log(`${LABELS[result.outcome]} ${result.message ?? result.file}`);
  return results.filter((result) => result.outcome === "fail").length;
}

async function main() {
  const { org, root, dir, help } = options();
  if (help) {
    console.log(USAGE);
    return;
  }
  if (dir && !org) throw new Error("--dir needs --org");
  const dataRoot = resolve(root ?? join(import.meta.dirname, "..", "public", "data"));
  const orgs = org ? [org] : Object.keys(tenants);
  let failures = 0;
  for (const name of orgs) failures += await validateOrg(name, resolve(dir ?? join(dataRoot, name, "views")));
  if (failures > 0) {
    console.error(`${failures} file(s) failed validation.`);
    process.exitCode = 1;
  }
}

await main();
