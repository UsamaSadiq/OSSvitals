import { useState } from "react";
import { MoonIcon, SunIcon } from "../components/icons";
import { applyTheme, currentTheme, type Theme } from "./theme";

function opposite(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const next = opposite(theme);

  function toggle() {
    applyTheme(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={`Switch to ${next} theme`}
      title={`Switch to the ${next} palette`}
      onClick={toggle}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
