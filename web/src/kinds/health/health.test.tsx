import { renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useView } from "../../data/useView";
import { OPENEDX_SITE_META, renderRoute } from "../../test/renderRoute";
import { TenantProvider } from "../../tenants/context";
import { healthTenant } from ".";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubMissingData(): void {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
}

describe("health tenant", () => {
  it("reads the views of its own org", async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = ({ children }: { children: ReactNode }) => <TenantProvider tenant={healthTenant("acme")}>{children}</TenantProvider>;
    renderHook(() => useView("repos"), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.map(([url]) => url)).toContainEqual(expect.stringContaining("/acme/views/repos.json"));
  });

  it("hides a page the org leaves out of its page list", async () => {
    stubMissingData();
    const meta = { ...OPENEDX_SITE_META, pages: ["/", "/glossary"] };
    renderRoute("/maintenance", meta, healthTenant("acme"));
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeTruthy();
  });

  it("keeps every page when the org publishes no page list", async () => {
    stubMissingData();
    renderRoute("/maintenance", OPENEDX_SITE_META, healthTenant("acme"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Page not found" })).toBeNull());
  });
});
