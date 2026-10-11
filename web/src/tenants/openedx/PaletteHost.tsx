import { useView } from "../../data/useView";
import { usePaletteIndex } from "../../search/usePaletteIndex";
import type { PaletteHostProps } from "../types";

function WithOwners({ pages, children }: Omit<PaletteHostProps, "maintainerViews">) {
  return <>{children(usePaletteIndex(pages, useView("owners")))}</>;
}

function WithoutOwners({ pages, children }: Omit<PaletteHostProps, "maintainerViews">) {
  return <>{children(usePaletteIndex(pages, null))}</>;
}

export function OpenedxPaletteHost({ maintainerViews, ...rest }: PaletteHostProps) {
  return maintainerViews ? <WithOwners {...rest} /> : <WithoutOwners {...rest} />;
}
