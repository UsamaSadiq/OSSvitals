import { useRef, useState } from "react";
import { Link, Outlet } from "react-router";
import { ErrorState } from "../components/ErrorState";
import { ThemeToggle } from "../theme/ThemeToggle";
import { Footer } from "./Footer";
import { FreshnessChip } from "./FreshnessChip";
import { HeaderShare } from "./HeaderShare";
import { Nav } from "./Nav";
import { NoindexMeta } from "./noindex";
import { useSiteMeta } from "./siteMeta";

const NAV_ID = "site-nav";

export function Shell() {
  const { shortName, loadError } = useSiteMeta();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const closeMenuAndFocusMain = () => {
    setMenuOpen(false);
    mainRef.current?.focus({ preventScroll: true });
  };

  return (
    <div className={menuOpen ? "shell shell--menu-open" : "shell"}>
      <NoindexMeta />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <button
          type="button"
          className="header__menu"
          aria-expanded={menuOpen}
          aria-controls={NAV_ID}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
        <Link to="/" className="header__wordmark">
          {shortName}
        </Link>
        <FreshnessChip />
        <div className="header__actions">
          <HeaderShare />
          <ThemeToggle />
        </div>
      </header>
      <aside className="sidebar">
        <Nav id={NAV_ID} onNavigate={closeMenuAndFocusMain} />
      </aside>
      <div className="content">
        <main id="main" ref={mainRef} tabIndex={-1} className="main">
          {loadError && <ErrorState title="Site settings could not be loaded." detail={loadError} />}
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
