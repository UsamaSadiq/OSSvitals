import { useState } from "react";
import { useLocation } from "react-router";

export type CopyState = "idle" | "copied" | "failed";

export const COPY_STATUS_TEXT: Record<CopyState, string> = {
  idle: "",
  copied: "Link copied.",
  failed: "Copy failed. Select the link below and copy it.",
};

export function shareUrl(origin: string, pathname: string, search: string): string {
  return `${origin}${pathname}${search}`;
}

interface CopiedUrl {
  url: string;
  state: CopyState;
}

export function useCopyCurrentUrl(): { url: string; state: CopyState; copy: () => Promise<void> } {
  const { pathname, search } = useLocation();
  const [copied, setCopied] = useState<CopiedUrl>({ url: "", state: "idle" });
  const url = shareUrl(window.location.origin, pathname, search);
  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => setCopied({ url, state: "copied" }),
      () => setCopied({ url, state: "failed" }),
    );
  const state = copied.url === url ? copied.state : "idle";
  return { url, state, copy };
}

export function ShareLink({ label = "Copy link to this view" }: { label?: string }) {
  const { url, state, copy } = useCopyCurrentUrl();
  return (
    <div className="share-link">
      <button type="button" className="button-link" onClick={copy}>
        {label}
      </button>
      <span className="caption" role="status">
        {COPY_STATUS_TEXT[state]}
      </span>
      {state === "failed" && <input className="share-link__url" readOnly value={url} aria-label="Link to this view" />}
    </div>
  );
}
