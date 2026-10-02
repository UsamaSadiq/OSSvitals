import { useState } from "react";
import { applyTheme, currentTheme, type Theme } from "./theme";

function opposite(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  function toggle() {
    const next = opposite(theme);
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-pressed={theme === "dark"}
      title="Switches the whole dashboard between the dark and light palettes."
      onClick={toggle}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span className="theme-toggle__thumb" />
      </span>
      Dark mode
    </button>
  );
}
