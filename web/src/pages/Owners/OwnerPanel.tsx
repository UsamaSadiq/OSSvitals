import { Link, useSearchParams } from "react-router";
import { EmptyState } from "../../components/EmptyState";
import { KpiTile } from "../../components/KpiTile";
import { ShareLink } from "../../components/ShareLink";
import type { OwnersView } from "../../data/schemas";
import { formatNumber, toFixedHalfEven } from "../../format";
import { OwnerReposTable } from "./OwnerTables";
import { gradeMixCaption, OWNER_PARAM, ownerKey, ownerSubtitle, type OwnerRecord } from "./ownerText";

function useSelectedOwner(): { selected: string; close: () => void } {
  const [params, setParams] = useSearchParams();
  const close = () => {
    const updated = new URLSearchParams(params);
    updated.delete(OWNER_PARAM);
    setParams(updated);
  };
  return { selected: ownerKey(params.get(OWNER_PARAM) ?? ""), close };
}

function OwnerTiles({ owner }: { owner: OwnerRecord }) {
  return (
    <div className="owners-tiles">
      <KpiTile label="Repositories" value={formatNumber(owner.repo_count)} />
      <KpiTile label="Average score" value={toFixedHalfEven(owner.avg_score, 1)} />
      <KpiTile label="Grade D or F" value={formatNumber(owner.d_or_f)} />
      <KpiTile label="At risk" value={formatNumber(owner.at_risk)} />
    </div>
  );
}

function OwnerDetails({ owners, owner, onClose }: { owners: OwnersView; owner: OwnerRecord; onClose: () => void }) {
  const mix = owners.grade_mix[owner.owner_key];
  return (
    <section className="owners-panel" aria-labelledby="owner-heading">
      <h2 id="owner-heading">{owner.owner}</h2>
      <p className="caption">{ownerSubtitle(owner)}</p>
      <OwnerTiles owner={owner} />
      {mix && <p className="caption">{gradeMixCaption(mix)}</p>}
      {owner.at_risk > 0 && (
        <p className="caption">
          <Link to="/at_risk">See the at-risk repositories</Link>
        </p>
      )}
      <OwnerReposTable owner={owner.owner} rows={owners.repos[owner.owner_key] ?? []} />
      <ShareLink label="Copy link to this owner" />
      <button type="button" className="button-link" onClick={onClose}>
        Close owner details
      </button>
    </section>
  );
}

export function OwnerPanel({ owners }: { owners: OwnersView }) {
  const { selected, close } = useSelectedOwner();
  if (!selected) return <p className="caption">Select an owner's row to see its repositories.</p>;
  const owner = owners.records.find((record) => record.owner_key === selected);
  if (!owner) {
    return (
      <EmptyState
        kind="info"
        title={`No owner named “${selected}” in this snapshot.`}
        body="It may have been renamed or removed."
      />
    );
  }
  return <OwnerDetails owners={owners} owner={owner} onClose={close} />;
}
