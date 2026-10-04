import { EmptyState } from "../../components/EmptyState";
import { activityNote, repoSignals, type Signal, type SignalGroup } from "./signalFormat";

interface ActivitySignalsProps {
  signals: readonly Signal[];
  record: Record<string, unknown>;
  unmeasured: readonly string[];
}

function GroupColumn({ group }: { group: SignalGroup }) {
  return (
    <div>
      <h3>{group.group}</h3>
      <ul>
        {group.items.map((item) => (
          <li key={item.label}>
            {item.label}: <strong>{item.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignalGroups({ groups, unmeasured }: { groups: readonly SignalGroup[]; unmeasured: readonly string[] }) {
  if (groups.length === 0) {
    return <EmptyState kind="info" title="This repository reports no issue, PR or CI signals in this snapshot." />;
  }
  return (
    <>
      <div className="repo-activity">
        {groups.map((group) => (
          <GroupColumn key={group.group} group={group} />
        ))}
      </div>
      <p className="caption">{activityNote(unmeasured)}</p>
    </>
  );
}

function snapshotHasSignals(signals: readonly Signal[], record: Record<string, unknown>): boolean {
  return signals.some((signal) => signal.column in record);
}

function NoSnapshotSignals() {
  return (
    <EmptyState
      kind="info"
      title="Issue, PR backlog, CI and newcomer signals are not in this snapshot yet."
      body="They appear once the upstream repo-health run starts reporting them."
    />
  );
}

export function ActivitySignals({ signals, record, unmeasured }: ActivitySignalsProps) {
  return (
    <section className="repo-detail-section" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Activity</h2>
      {snapshotHasSignals(signals, record) ? (
        <SignalGroups groups={repoSignals(signals, record, unmeasured)} unmeasured={unmeasured} />
      ) : (
        <NoSnapshotSignals />
      )}
    </section>
  );
}
