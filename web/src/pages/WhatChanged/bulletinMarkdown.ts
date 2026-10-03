export type BulletinBlock =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

type LineBlock = Exclude<BulletinBlock, { kind: "list" }> | { kind: "item"; text: string };

function classifyLine(line: string): LineBlock | null {
  if (line.startsWith("## ")) return { kind: "heading", level: 2, text: line.slice(3) };
  if (line.startsWith("### ")) return { kind: "heading", level: 3, text: line.slice(4) };
  if (line.startsWith("- ")) return { kind: "item", text: line.slice(2) };
  const text = line.trim();
  return text ? { kind: "paragraph", text } : null;
}

function appendItem(blocks: readonly BulletinBlock[], text: string): BulletinBlock[] {
  const last = blocks.at(-1);
  if (last?.kind === "list") return [...blocks.slice(0, -1), { kind: "list", items: [...last.items, text] }];
  return [...blocks, { kind: "list", items: [text] }];
}

function appendLine(blocks: readonly BulletinBlock[], line: LineBlock | null): BulletinBlock[] {
  if (!line) return [...blocks];
  return line.kind === "item" ? appendItem(blocks, line.text) : [...blocks, line];
}

export function parseBulletin(markdown: string): BulletinBlock[] {
  return markdown.split(/\r?\n/).reduce<BulletinBlock[]>((blocks, line) => appendLine(blocks, classifyLine(line)), []);
}
