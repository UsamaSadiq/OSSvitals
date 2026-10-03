import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadView } from "./load";
import type { ViewName } from "./schemas";
import { useView } from "./useView";

vi.mock("./load", () => ({ loadView: vi.fn() }));

interface Deferred {
  promise: Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

function deferred(): Deferred {
  let resolve: Deferred["resolve"] = () => {};
  let reject: Deferred["reject"] = () => {};
  const promise = new Promise<unknown>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

const loadViewMock = vi.mocked(loadView);

function stubLoads(): Map<string, Deferred> {
  const pending = new Map<string, Deferred>();
  loadViewMock.mockImplementation((name: ViewName) => {
    const load = deferred();
    pending.set(name, load);
    return load.promise as ReturnType<typeof loadView>;
  });
  return pending;
}

beforeEach(() => {
  loadViewMock.mockReset();
});

describe("useView", () => {
  it("starts loading and then exposes the parsed view", async () => {
    const pending = stubLoads();
    const { result } = renderHook(() => useView("meta", "openedx"));
    expect(result.current.status).toBe("loading");
    expect(loadViewMock).toHaveBeenCalledWith("meta", "openedx");

    await act(async () => pending.get("meta")?.resolve({ name: "meta-data" }));

    expect(result.current).toEqual({ status: "ready", data: { name: "meta-data" }, error: undefined });
  });

  it("maps a rejection to an Error", async () => {
    const pending = stubLoads();
    const { result } = renderHook(() => useView("meta", "openedx"));

    await act(async () => pending.get("meta")?.reject("offline"));

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("offline");
  });

  it("keeps an Error rejection as is", async () => {
    const pending = stubLoads();
    const failure = new Error("bad schema");
    const { result } = renderHook(() => useView("meta", "openedx"));

    await act(async () => pending.get("meta")?.reject(failure));

    expect(result.current.error).toBe(failure);
  });

  it("ignores a stale load after the view name changes", async () => {
    const pending = stubLoads();
    const { result, rerender } = renderHook(({ name }: { name: ViewName }) => useView(name, "openedx"), {
      initialProps: { name: "meta" as ViewName },
    });
    rerender({ name: "history" });
    expect(result.current.status).toBe("loading");

    await act(async () => pending.get("history")?.resolve({ name: "history-data" }));
    await act(async () => pending.get("meta")?.resolve({ name: "meta-data" }));

    expect(result.current.data).toEqual({ name: "history-data" });
  });
});
