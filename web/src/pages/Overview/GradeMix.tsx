import {
  gradeRibbonSegments,
  gradeFill,
  gradeTextFill,
  type GradeMix as GradeMixCounts,
  type RibbonSegment,
} from "../../components/charts";
import { formatNumber } from "../../format";

function ribbonDescription(mix: GradeMixCounts): string {
  return gradeRibbonSegments(mix)
    .map((segment) => `Grade ${segment.grade}: ${segment.count} repos (${formatNumber(segment.percent, 1)}%)`)
    .join(", ");
}

function SegmentLabel({ segment }: { segment: RibbonSegment }) {
  if (segment.labelDetail === "none") return null;
  if (segment.labelDetail === "letter") return <>{segment.grade}</>;
  return (
    <>
      {segment.grade}
      <span className="grade-ribbon__count"> · {segment.count}</span>
    </>
  );
}

export function GradeMix({ mix }: { mix: GradeMixCounts }) {
  const segments = gradeRibbonSegments(mix);
  return (
    <section className="overview-section" aria-labelledby="grade-mix-heading">
      <h2 id="grade-mix-heading">Grade mix</h2>
      <div className="grade-ribbon" role="img" aria-label={ribbonDescription(mix)}>
        {segments.map((segment) => (
          <span
            key={segment.grade}
            className="grade-ribbon__segment"
            title={`Grade ${segment.grade}: ${segment.count} repos (${formatNumber(segment.percent, 1)}%)`}
            style={{ flexGrow: segment.count, background: gradeFill(segment.grade), color: gradeTextFill(segment.grade) }}
          >
            <SegmentLabel segment={segment} />
          </span>
        ))}
      </div>
    </section>
  );
}
