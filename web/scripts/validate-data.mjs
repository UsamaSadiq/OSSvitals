import { access, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import tenants from "../../dashboard/config/tenants.json" with { type: "json" };
import { checkViews } from "../src/data/checkViews.ts";

const PRUNED_EXIT = 3;

const USAGE = `Usage: npm run validate-data -- [--org <org>] [--root <path> | --dir <path>] [--prune]

Parses every view file of each tenant in dashboard/config/tenants.json with the
zod schemas of its kind (health: src/data/schemas.ts, fleet:
src/kinds/fleet/schemas.ts). Exits 1 if a required file is missing, or any file
is not JSON or does not match its schema. Optional fleet views may be absent.
Checking every tenant skips one with no views directory yet (not collected).

  --org <org>   check one tenant (default: every tenant)
  --root <path> directory holding <org>/views (default: public/data)
  --dir <path>  directory holding the view files of the one --org tenant
  --prune       delete the views directory of each tenant that fails and exit
                ${PRUNED_EXIT} instead of 1, so callers can still publish the others
  --help        show this message`;

function options() {
  const { values } = parseArgs({
    options: {
      org: { type: "string" },
      root: { type: "string" },
      dir: { type: "string" },
      prune: { type: "boolean", default: false },
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

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { org, root, dir, prune, help } = options();
  if (help) {
    console.log(USAGE);
    return;
  }
  if (dir && !org) throw new Error("--dir needs --org");
  const dataRoot = resolve(root ?? join(import.meta.dirname, "..", "public", "data"));
  const orgs = org ? [org] : Object.keys(tenants);
  const failed = [];
  for (const name of orgs) {
    const viewsDir = resolve(dir ?? join(dataRoot, name, "views"));
    if (!org && !(await exists(viewsDir))) {
      console.log(`Skipping ${name}: no views published yet`);
      continue;
    }
    if ((await validateOrg(name, viewsDir)) > 0) failed.push({ name, viewsDir });
  }
  if (failed.length === 0) return;
  console.error(`Views failed validation for: ${failed.map(({ name }) => name).join(", ")}`);
  if (!prune) {
    process.exitCode = 1;
    return;
  }
  for (const { viewsDir } of failed) await rm(viewsDir, { recursive: true, force: true });
  console.error("Removed their views so the other tenants can still be published.");
  process.exitCode = PRUNED_EXIT;
}

await main();
