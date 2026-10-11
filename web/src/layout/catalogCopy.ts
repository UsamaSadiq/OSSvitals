import type { CatalogMeta } from "./siteMeta";

export function membershipNote(catalog: CatalogMeta): string {
  const scope = catalog.membershipScope ?? "organization membership";
  return `User owners are checked against GitHub; group owners are not, since that needs ${scope}.`;
}

export function missingFileNote(catalog: CatalogMeta): string {
  const listing = `${catalog.name ?? "The catalog"} does not list it and its owner is unknown.`;
  return catalog.specName ? `${listing} ${catalog.specName} describes the file.` : listing;
}
