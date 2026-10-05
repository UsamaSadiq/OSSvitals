import type { ComponentType } from "react";
import {
  AlertIcon,
  ChecklistIcon,
  ComponentsIcon,
  GaugeIcon,
  HistoryIcon,
  HomeIcon,
  RepoIcon,
  ShieldIcon,
  UpgradeIcon,
  UsersIcon,
  XCircleIcon,
} from "../components/icons";

type PageIcon = ComponentType<{ className?: string }>;

const PAGE_ICONS: Record<string, PageIcon> = {
  "/": HomeIcon,
  "/repo_detail": RepoIcon,
  "/failing_checks": XCircleIcon,
  "/what_changed": HistoryIcon,
  "/needing_attention": AlertIcon,
  "/at_risk": ShieldIcon,
  "/ownership_views": UsersIcon,
  "/maintenance": UpgradeIcon,
  "/components": ComponentsIcon,
  "/glossary": ChecklistIcon,
  "/scoring": GaugeIcon,
};

export function PageIcon({ path, className }: { path: string; className?: string }) {
  const Icon = PAGE_ICONS[path];
  return Icon ? <Icon className={className} /> : null;
}
