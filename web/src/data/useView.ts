import { useEffect, useState } from "react";
import { loadView } from "./load";
import { useTenantOrg } from "../tenants/context";
import type { View, ViewName } from "./schemas";

export type ViewState<Name extends ViewName> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: View<Name>; error: undefined }
  | { status: "error"; data: undefined; error: Error };

const LOADING = { status: "loading", data: undefined, error: undefined } as const;

function toError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(String(reason));
}

export function useView<Name extends ViewName>(name: Name, orgOverride?: string): ViewState<Name> {
  const tenantOrg = useTenantOrg();
  const org = orgOverride ?? tenantOrg;
  const [state, setState] = useState<ViewState<Name>>(LOADING);

  useEffect(() => {
    let active = true;
    setState(LOADING);
    loadView(name, org).then(
      (data) => active && setState({ status: "ready", data, error: undefined }),
      (reason: unknown) => active && setState({ status: "error", data: undefined, error: toError(reason) }),
    );
    return () => {
      active = false;
    };
  }, [name, org]);

  return state;
}
