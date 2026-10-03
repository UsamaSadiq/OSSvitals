import { Link } from "react-router";
import { usePageTitle } from "../layout/pageTitle";

export function NotFound() {
  usePageTitle("Page not found");

  return (
    <section className="page" aria-labelledby="page-title">
      <h1 id="page-title">Page not found</h1>
      <p>There is no page at this address.</p>
      <p>
        <Link to="/">Go to the Overview</Link>
      </p>
    </section>
  );
}
