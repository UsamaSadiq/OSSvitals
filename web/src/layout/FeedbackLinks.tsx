import { useLocation } from "react-router";
import { currentOrg } from "../data/org";
import { newIssueUrl, type IssueKind } from "../feedback/issueUrl";
import { useSiteMeta } from "./siteMeta";

const FEEDBACK_LABELS: Record<IssueKind, string> = {
  bug: "Report a bug",
  data: "Flag wrong data",
  question: "Ask a question",
};

export function FeedbackLinks() {
  const { footer, snapshotDate } = useSiteMeta();
  const { pathname, search } = useLocation();
  const { sourceUrl } = footer;
  if (!sourceUrl) return null;

  const context = {
    tenant: currentOrg(),
    page: `${window.location.origin}${pathname}${search}`,
    dataDate: snapshotDate,
  };
  const kinds = Object.keys(FEEDBACK_LABELS) as IssueKind[];

  return (
    <p className="footer__links">
      {kinds.map((kind, index) => (
        <span key={kind}>
          {index > 0 && " · "}
          <a href={newIssueUrl(sourceUrl, kind, context)} target="_blank" rel="noopener noreferrer">
            {FEEDBACK_LABELS[kind]}
          </a>
        </span>
      ))}
    </p>
  );
}
