import { useState } from "react";
import { useLocation } from "react-router";

type CopyState = "idle" | "copied" | "failed";

const STATUS_TEXT: Record<CopyState, string> = {
  idle: "",
  copied: "Link copied.",
  failed: "Copy failed. Select the link below and copy it.",
};

export function shareUrl(origin: string, pathname: string, search: string): string {
  return `${origin}${pathname}${search}`;
}

export function ShareLink({ label = "Copy link to this view" }: { label?: string }) {
  const { pathname, search } = useLocation();
  const [state, setState] = useState<CopyState>("idle");
  const url = shareUrl(window.location.origin, pathname, search);
  const copy = () =>
    navigator.clipboard.writeText(url).then(
      () => setState("copied"),
      () => setState("failed"),
    );
  return (
    <div className="share-link">
      <button type="button" className="button-link" onClick={copy}>
        {label}
      </button>
      <span className="caption" role="status">
        {STATUS_TEXT[state]}
      </span>
      {state === "failed" && <input className="share-link__url" readOnly value={url} aria-label="Link to this view" />}
    </div>
  );
}
