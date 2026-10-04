import { EmptyState } from "../../components/EmptyState";
import { MISSING_BODY, missingTitle } from "./upgradesText";

export function MissingData({ what }: { what: string }) {
  return <EmptyState kind="info" title={missingTitle(what)} body={MISSING_BODY} />;
}
