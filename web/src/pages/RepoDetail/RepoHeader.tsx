import { GradePill } from "../../components/GradePill";
import { KpiTile } from "../../components/KpiTile";
import { RepoName } from "../../components/RepoName";
import { ShareLink } from "../../components/ShareLink";
import { toFixedHalfEven } from "../../format";
import { WatchButton } from "../../watchlist/WatchButton";
import type { RepoDetail, RepoRecord } from "./repoDetailData";
import { StatusChip } from "./StatusChip";

type Subscore = RepoDetail["subscores"]["structural"];

const NO_VALUE = "—";

function subscoreText({ value }: Subscore): string {
  return value === null ? NO_VALUE : toFixedHalfEven(value, 1);
}

export function coverageLabel({ available, total, coverage_pct }: RepoDetail["summary"]): string {
  return `${available}/${total} metrics (${toFixedHalfEven(coverage_pct, 0)}% weight)`;
}

export function RepoHeader({ repo, record, detail }: { repo: string; record: RepoRecord; detail: RepoDetail }) {
  const { structural, activity } = detail.subscores;
  return (
    <>
      <div className="repo-header">
        <h2>
          <RepoName name={repo} />
        </h2>
        <GradePill grade={record.score_letter} />
        <StatusChip status={detail.summary.level} label={coverageLabel(detail.summary)} />
        <span className="repo-header__actions">
          <WatchButton repo={repo} />
        </span>
      </div>
      <div className="repo-kpis">
        <KpiTile label="Composite" value={toFixedHalfEven(record.score_composite, 1)} />
        <KpiTile label="Grade" value={record.score_letter} />
        <KpiTile label="Structural" value={subscoreText(structural)} help={structural.help} />
        <KpiTile label="Activity" value={subscoreText(activity)} help={activity.help} />
      </div>
      <ShareLink label="Copy link to this view" />
    </>
  );
}
