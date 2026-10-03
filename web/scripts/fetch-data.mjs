import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { VIEW_NAMES, viewFileName } from "../src/data/schemas.ts";

const BASE_URL = "https://raw.githubusercontent.com/UsamaSadiq/OSSvitals/data";

const USAGE = `Usage: npm run fetch-data -- [--org <org>] [--dir <path>]

Downloads <org>/views/*.json from the OSSvitals data branch.

  --org <org>   org to download (default: openedx)
  --dir <path>  directory to write into (default: public/data/<org>/views)
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

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function fetchView(org, dir, name) {
  const file = viewFileName(name);
  const body = await download(`${BASE_URL}/${org}/views/${file}`);
  await writeFile(join(dir, file), body, "utf8");
  return { file, bytes: Buffer.byteLength(body) };
}

async function main() {
  const { org, dir, help } = options();
  if (help) {
    console.log(USAGE);
    return;
  }
  const outDir = resolve(dir ?? join(import.meta.dirname, "..", "public", "data", org, "views"));
  await mkdir(outDir, { recursive: true });
  const results = await Promise.allSettled(VIEW_NAMES.map((name) => fetchView(org, outDir, name)));
  for (const result of results) {
    if (result.status === "fulfilled") console.log(`ok    ${result.value.file} (${result.value.bytes} bytes)`);
    else console.error(`FAIL  ${result.reason instanceof Error ? result.reason.message : result.reason}`);
  }
  if (results.some((result) => result.status === "rejected")) process.exitCode = 1;
  else console.log(`Wrote ${results.length} files to ${outDir}`);
}

await main();
