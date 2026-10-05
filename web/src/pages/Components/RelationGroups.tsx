import { RepoName } from "../../components/RepoName";
import {
  groupRelations,
  statusCountText,
  statusCounts,
  type RelationGroup,
  type RelationRow,
} from "./componentRows";

function relationCountText(count: number): string {
  return `${count} ${count === 1 ? "relation" : "relations"}`;
}

function RelationTable({ group }: { group: RelationGroup }) {
  const caption = `Relations declared by ${group.repo}`;
  return (
    <div className="table-scroll data-table__scroll" role="region" aria-label={`${caption}, scrollable`} tabIndex={0}>
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Relation</th>
            <th scope="col">Target</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {group.relations.map((relation) => (
            <tr key={`${relation.relation}|${relation.target}`}>
              <td>{relation.relation}</td>
              <td>{relation.target}</td>
              <td>{relation.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RelationGroupItem({ group }: { group: RelationGroup }) {
  return (
    <li>
      <details className="relation-group">
        <summary>
          <span className="relation-group__line">
            <RepoName name={group.repo} />
            <span className="relation-group__counts">
              {relationCountText(group.relations.length)} · {statusCountText(statusCounts(group.relations))}
            </span>
          </span>
        </summary>
        <div className="relation-group__body">
          <RelationTable group={group} />
        </div>
      </details>
    </li>
  );
}

export function RelationGroups({ rows }: { rows: readonly RelationRow[] }) {
  return (
    <ul className="relation-groups">
      {groupRelations(rows).map((group) => (
        <RelationGroupItem key={group.repo} group={group} />
      ))}
    </ul>
  );
}
