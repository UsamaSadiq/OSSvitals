import { ownerPath } from "../../components/ownerPath";
import { formatUtcDate } from "../../format";
import type { RepoRecord } from "./repoDetailData";

export interface HeaderChip {
  id: "tier" | "owner" | "lifecycle" | "push";
  label: string;
  value: string;
  to?: string;
}

const LEADING_DATE = /^\d{4}-\d{2}-\d{2}/;

export function githubUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function pushDate(value: string | null | undefined): string | null {
  const raw = text(value);
  if (raw === null) return null;
  return raw.match(LEADING_DATE)?.[0] ?? (formatUtcDate(raw) || null);
}

function chip(id: HeaderChip["id"], label: string, value: string | null, to?: string): HeaderChip[] {
  if (value === null) return [];
  return [to === undefined ? { id, label, value } : { id, label, value, to }];
}

function ownerChip(name: string | null): HeaderChip[] {
  return chip("owner", "Owner", name, name === null ? undefined : ownerPath(name.toLowerCase()));
}

export function headerChips(record: RepoRecord): HeaderChip[] {
  return [
    ...chip("tier", "Tier", text(record.repo_tier)),
    ...ownerChip(text(record["ownership.owner_name"])),
    ...chip("lifecycle", "Lifecycle", text(record["ownership.lifecycle"])),
    ...chip("push", "Last push", pushDate(record["github.last_push"])),
  ];
}
