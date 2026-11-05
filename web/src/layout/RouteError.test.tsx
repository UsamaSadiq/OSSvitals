import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteError } from "./RouteError";

function Thrower({ error }: { error: Error }): never {
  throw error;
}

function renderWithError(error: Error) {
  const router = createMemoryRouter([{ path: "/", element: <Thrower error={error} />, errorElement: <RouteError /> }]);
  render(<RouterProvider router={router} />);
}

describe("RouteError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("explains a stale build instead of showing the router's developer screen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/SupportWindow-old.js"));

    expect(await screen.findByRole("heading", { name: "This page has been updated" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });

  it("shows a plain error page for anything else", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderWithError(new Error("boom"));

    expect(await screen.findByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });
});
