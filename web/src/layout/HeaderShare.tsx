import { useEffect, useState } from "react";
import { LinkIcon } from "../components/icons";
import { useCopyCurrentUrl } from "../components/ShareLink";

const TOAST_MS = 2500;

const STATUS_TEXT = { idle: "", copied: "Link copied.", failed: "Copy failed. Copy the link below." } as const;

function useToastVisible(trigger: number): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [trigger]);
  return visible;
}

export function HeaderShare() {
  const { url, state, copy } = useCopyCurrentUrl();
  const [clicks, setClicks] = useState(0);
  const toastVisible = useToastVisible(clicks);
  const message = state === "failed" || toastVisible ? STATUS_TEXT[state] : "";
  const share = () => copy().finally(() => setClicks((count) => count + 1));

  return (
    <div className="header-share">
      <button type="button" className="icon-button" aria-label="Copy page link" title="Copy a link to this page" onClick={share}>
        <LinkIcon />
      </button>
      <span className="header-share__toast" role="status">
        {message}
      </span>
      {state === "failed" && (
        <input className="header-share__fallback" readOnly value={url} aria-label="Link to this page" />
      )}
    </div>
  );
}
