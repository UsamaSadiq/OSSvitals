import { DataTable, type Column } from "../../components/DataTable";
import { RepoPillList } from "../../components/RepoPillList";
import { RepoLink } from "../../components/RepoName";
import type { OverviewView } from "../../data/schemas";
import { formatScoreChange, moversCaption } from "./overviewText";

type Mover = OverviewView["gainers"][number];

const MOVER_COLUMNS: Column<Mover>[] = [
  { key: "repo", header: "Repository", cell: (row) => <RepoLink name={row.repo_name} /> },
  { key: "delta", header: "Change", cell: (row) => formatScoreChange(row.delta), numeric: true },
];

function MoverTable({ title, rows, emptyMessage }: { title: string; rows: readonly Mover[]; emptyMessage: string }) {
  return (
    <div className="mover-table">
      <h3>{title}</h3>
      <DataTable
        caption={title}
        captionHidden
        columns={MOVER_COLUMNS}
        rows={rows}
        rowKey={(row) => row.repo_name}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}

function Movers({ overview }: { overview: OverviewView }) {
  if (overview.movers.length === 0) return null;
  return (
    <>
      <div className="two-columns">
        <MoverTable
          title="Biggest gainers"
          rows={overview.gainers}
          emptyMessage="No repositories improved over this window."
        />
        <MoverTable
          title="Biggest losers"
          rows={overview.losers}
          emptyMessage="No repositories declined over this window."
        />
      </div>
      <p className="caption">{moversCaption(overview.movers_from, overview.movers_to)}</p>
    </>
  );
}

export function Highlights({ overview }: { overview: OverviewView }) {
  return (
    <section className="overview-section" aria-labelledby="highlights-heading">
      <h2 id="highlights-heading">Highlights</h2>
      <div className="two-columns">
        <div>
          <h3>Top 5</h3>
          <RepoPillList rows={overview.highlights.top} label="Top 5" />
        </div>
        <div>
          <h3>Bottom 5</h3>
          <RepoPillList rows={overview.highlights.bottom} label="Bottom 5" />
        </div>
      </div>
      <Movers overview={overview} />
    </section>
  );
}
