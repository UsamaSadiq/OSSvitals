import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRoute } from "../test/renderRoute";

function stubClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

describe("HeaderShare", () => {
  it("copies the current URL and confirms it", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    stubClipboard(writeText);
    renderRoute("/needing_attention?tier=critical");
    const header = await screen.findByRole("banner");

    await userEvent.click(within(header).getByRole("button", { name: "Copy page link" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/needing_attention?tier=critical`);
    expect(await within(header).findByText("Link copied.")).toHaveAttribute("role", "status");
  });

  it("shows the URL to copy by hand when the clipboard refuses", async () => {
    stubClipboard(() => Promise.reject(new Error("denied")));
    renderRoute("/");
    const header = await screen.findByRole("banner");

    await userEvent.click(within(header).getByRole("button", { name: "Copy page link" }));

    expect(await within(header).findByRole("textbox", { name: "Link to this page" })).toHaveValue(`${window.location.origin}/`);
  });
});
