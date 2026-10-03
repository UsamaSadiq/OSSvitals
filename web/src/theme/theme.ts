export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "ossvitals-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

export function currentTheme(): Theme {
  const attribute = document.documentElement.getAttribute("data-theme");
  return isTheme(attribute) ? attribute : "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this page view.
  }
}
