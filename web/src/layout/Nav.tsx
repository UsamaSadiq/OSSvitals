import { NavLink } from "react-router";
import { visibleSections } from "../pages/catalog";
import { useTenant } from "../tenants/context";
import type { NavSection } from "../tenants/types";
import { NavCount } from "./NavCount";
import { PageIcon } from "./navIcons";
import { useSiteMeta } from "./siteMeta";

function sectionHeadingId(section: NavSection): string {
  return `nav-section-${section.title.toLowerCase()}`;
}

function linkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? "nav__link nav__link--active" : "nav__link";
}

export function Nav({ id, onNavigate }: { id: string; onNavigate?: () => void }) {
  const { featureFlags, pages } = useSiteMeta();
  const { sections: tenantSections } = useTenant();
  const sections = visibleSections(tenantSections, { maintainerViews: featureFlags.enableMaintainerViews, manifest: pages });

  return (
    <nav id={id} className="nav" aria-label="Pages">
      {sections.map((section) => (
        <div key={section.title} className="nav__section">
          <h2 id={sectionHeadingId(section)} className="nav__heading">
            {section.title}
          </h2>
          <ul aria-labelledby={sectionHeadingId(section)} className="nav__list">
            {section.pages.map((page) => (
              <li key={page.path}>
                <NavLink to={page.path} end className={linkClassName} onClick={onNavigate}>
                  <PageIcon path={page.path} className="nav__icon" />
                  <span className="nav__label">{page.title}</span>
                  <NavCount path={page.path} />
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
