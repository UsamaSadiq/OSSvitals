import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseView } from "../src/data/parse.ts";
import { VIEW_NAMES, viewFileName } from "../src/data/schemas.ts";

const USAGE = `Usage: npm run validate-data -- [--org <org>] [--dir <path>]

Parses every view file with the zod schemas in src/data/schemas.ts.
Exits 1 if any file is missing, is not JSON, or does not match its schema.

  --org <org>   org whose views to check (default: openedx)
  --dir <path>  directory holding the view files
                (default: public/data/<org>/views)
  --help        show this message`;

function options() {
  const { values } = parseArgs({
    options: {
      org: { type: "string", default: "openedx" },
      dir: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  return values;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function validateFile(dir, name) {
  const file = viewFileName(name);
  try {
    parseView(name, await readJson(join(dir, file)));
    return { file, ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { file, ok: false, message: message.startsWith(`${file}:`) ? message : `${file}: ${message}` };
  }
}

async function main() {
  const { org, dir, help } = options();
  if (help) {
    console.log(USAGE);
    return;
  }
  const viewsDir = resolve(dir ?? join(import.meta.dirname, "..", "public", "data", org, "views"));
  const results = await Promise.all(VIEW_NAMES.map((name) => validateFile(viewsDir, name)));
  console.log(`Validating ${viewsDir}`);
  for (const result of results) console.log(result.ok ? `ok    ${result.file}` : `FAIL  ${result.message}`);
  const failures = results.filter((result) => !result.ok).length;
  if (failures > 0) {
    console.error(`${failures} of ${results.length} files failed validation.`);
    process.exitCode = 1;
  }
}

await main();
