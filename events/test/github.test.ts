import { gitHubClient, pullQuery } from "../src/github.ts";

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: (url: URL, init: RequestInit) => Response): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    return respond(new URL(url), init);
  }) as typeof fetch;
  return { fetch: fetchImpl, calls };
}

function client(fetchImpl: typeof fetch) {
  return gitHubClient({
    fetch: fetchImpl,
    token: "t",
    org: "openedx",
    targetRepo: "UsamaSadiq/OSSvitals",
    workflow: "collect-maintenance.yml",
    ref: "main",
  });
}

function header(init: RequestInit, name: string): string | undefined {
  return (init.headers as Record<string, string>)[name];
}

function pushedPage(startHour: number, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `repo-${startHour}-${index}`,
    pushed_at: new Date(Date.UTC(2026, 9, 23, startHour, 0, 0) - index * 1000).toISOString(),
  }));
}

describe("pushedRepos", () => {
  it("sends the stored ETag and reports an unchanged list", async () => {
    const { fetch, calls } = fakeFetch(() => new Response(null, { status: 304 }));
    expect(await client(fetch).pushedRepos('"etag"', "2026-10-23T00:00:00Z")).toEqual({ status: "unchanged" });
    expect(header(calls[0]!.init, "If-None-Match")).toBe('"etag"');
    expect(header(calls[0]!.init, "Authorization")).toBe("Bearer t");
    expect(calls[0]!.url).toContain("/orgs/openedx/repos?sort=pushed&direction=desc");
  });

  it("reads another page only while every repo on the page is newer than the watermark", async () => {
    const pages: Record<string, unknown[]> = { "1": pushedPage(6, 100), "2": pushedPage(5, 100), "3": pushedPage(4, 100) };
    const { fetch, calls } = fakeFetch((url) => Response.json(pages[url.searchParams.get("page")!], { headers: { ETag: '"new"' } }));
    const list = await client(fetch).pushedRepos(null, "2026-10-23T05:00:00Z");
    expect(calls).toHaveLength(2);
    expect(list.status === "changed" && list.repos).toHaveLength(200);
    expect(list.status === "changed" && list.etag).toBe('"new"');
  });

  it("fails loudly on an API error", async () => {
    const { fetch } = fakeFetch(() => new Response("nope", { status: 403 }));
    await expect(client(fetch).pushedRepos(null, null)).rejects.toThrow("GitHub 403");
  });
});

describe("updatedPulls", () => {
  it("searches PRs updated after the watermark", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({ items: [] }));
    await client(fetch).updatedPulls("2026-10-23T06:03:35Z");
    expect(calls[0]!.url).toContain(`q=${encodeURIComponent("org:openedx is:pr updated:>2026-10-23T06:03:35Z")}`);
    expect(calls[0]!.url).toContain("updated%3A%3E");
    expect(calls[0]!.url).toContain("sort=updated&order=desc&per_page=100");
  });

  it("asks for just the newest PR when there is no watermark yet", async () => {
    const { fetch, calls } = fakeFetch(() => Response.json({ items: [] }));
    await client(fetch).updatedPulls(null);
    expect(pullQuery("openedx", null)).toBe("org:openedx is:pr");
    expect(calls[0]!.url).toContain("per_page=1&");
    expect(calls).toHaveLength(1);
  });
});

describe("workflow", () => {
  it("is busy while any recent run is not completed", async () => {
    const runs = (statuses: string[]) => Response.json({ workflow_runs: statuses.map((status) => ({ status })) });
    expect(await client(fakeFetch(() => runs(["completed", "queued"])).fetch).workflowBusy()).toBe(true);
    expect(await client(fakeFetch(() => runs(["completed"])).fetch).workflowBusy()).toBe(false);
  });

  it("dispatches the repos as one space-separated input on the configured ref", async () => {
    const { fetch, calls } = fakeFetch(() => new Response(null, { status: 204 }));
    await client(fetch).dispatch(["edx-platform", "xblock-lti-consumer"]);
    expect(calls[0]!.url).toBe("https://api.github.com/repos/UsamaSadiq/OSSvitals/actions/workflows/collect-maintenance.yml/dispatches");
    expect(calls[0]!.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ ref: "main", inputs: { repos: "edx-platform xblock-lti-consumer" } });
  });
});
