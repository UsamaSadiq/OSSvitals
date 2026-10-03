import { useLocation } from "react-router";
import { usePageTitle } from "../layout/pageTitle";
import { legacyBaseUrl, legacyPageUrl } from "./legacyUrl";

export function Placeholder({ title }: { title: string }) {
  usePageTitle(title);
  const { pathname, search } = useLocation();
  const href = legacyPageUrl(legacyBaseUrl(import.meta.env.VITE_LEGACY_URL), pathname, search);

  return (
    <section className="page placeholder" aria-labelledby="page-title">
      <h1 id="page-title">{title}</h1>
      <p>This page has not been ported to the new dashboard yet.</p>
      <p>
        <a className="button-link" href={href}>
          Open {title} on the current dashboard
        </a>
      </p>
    </section>
  );
}
