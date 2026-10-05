import type { ReactNode } from "react";

function Icon({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Icon>
  );
}

export function MoonIcon() {
  return (
    <Icon>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </Icon>
  );
}

export function LinkIcon() {
  return (
    <Icon>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Icon>
  );
}

export function InfoIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </Icon>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m8 12 3 3 5-6" />
    </Icon>
  );
}

type IconProps = { className?: string };

export function SearchIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  );
}

export function RepoIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 19.5V5a2 2 0 0 1 2-2h14v14H6.5A2.5 2.5 0 0 0 4 19.5z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </Icon>
  );
}

export function XCircleIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15 9-6 6M9 9l6 6" />
    </Icon>
  );
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </Icon>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Icon>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4M12 16h.01" />
    </Icon>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21v-1a6 6 0 0 1 12 0v1M16 3.1a4 4 0 0 1 0 7.8M22 21v-1a6 6 0 0 0-4-5.7" />
    </Icon>
  );
}

export function UpgradeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m16 12-4-4-4 4M12 16V8" />
    </Icon>
  );
}

export function ComponentsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m12 2 9 5-9 5-9-5z" />
      <path d="m3 12 9 5 9-5M3 17l9 5 9-5" />
    </Icon>
  );
}

export function ChecklistIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m3 6 2 2 3-3M3 13l2 2 3-3M12 6h9M12 13h9M12 20h9M4 20h.01" />
    </Icon>
  );
}

export function GaugeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4.9 19.1A10 10 0 1 1 19.1 19.1" />
      <path d="m12 13 4-5" />
      <circle cx="12" cy="13" r="1.5" />
    </Icon>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
    </Icon>
  );
}

export function ListIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </Icon>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  );
}
