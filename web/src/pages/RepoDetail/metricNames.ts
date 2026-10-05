const ACRONYMS: Record<string, string> = { ci: "CI", pr: "PR", readme: "README" };
const FILE_NAMES: Record<string, string> = { "openedx yaml": "openedx.yaml" };

export function metricKey(metric: string): string {
  return metric.trim().toLowerCase().replace(/[\s_]+/g, "_");
}

function spaced(metric: string): string {
  return metricKey(metric).replace(/_/g, " ");
}

function withFileNames(text: string): string {
  return Object.entries(FILE_NAMES).reduce((result, [words, file]) => result.replace(words, file), text);
}

function withAcronyms(text: string): string {
  return text
    .split(" ")
    .map((word) => ACRONYMS[word] ?? word)
    .join(" ");
}

function capitalised(text: string): string {
  const [first = ""] = text.split(" ");
  if (first.includes(".") || first === first.toUpperCase()) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function humanizeMetric(metric: string): string {
  return capitalised(withAcronyms(withFileNames(spaced(metric))));
}

export function wrapWords(text: string, maxChars: number): string[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((lines, word) => {
      const last = lines.at(-1);
      if (last !== undefined && `${last} ${word}`.length <= maxChars) return [...lines.slice(0, -1), `${last} ${word}`];
      return [...lines, word];
    }, []);
}
