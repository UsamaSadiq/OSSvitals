import { pullLabel } from "./upgradesText";

export function PullLink({ url }: { url: string | null | undefined }) {
  return url ? <a href={url}>{pullLabel(url)}</a> : null;
}
