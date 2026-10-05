import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY } from "./theme";
import { ThemeToggle } from "./ThemeToggle";

afterEach(() => {
  document.documentElement.setAttribute("data-theme", "dark");
  window.localStorage.clear();
});

describe("ThemeToggle", () => {
  it("switches the theme, persists the choice and relabels itself", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<ThemeToggle />);
    const toggle = screen.getByRole("button", { name: "Switch to light theme" });

    fireEvent.click(toggle);

    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(toggle).toHaveAccessibleName("Switch to dark theme");
  });

  it("starts in the light state when the page loaded light", () => {
    document.documentElement.setAttribute("data-theme", "light");
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });
});
