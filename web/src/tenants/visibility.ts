import index from "../../../dashboard/config/tenants.json";

type VisibilityIndex = Readonly<Record<string, { readonly site: string; readonly visibility?: string }>>;

/** A private tenant's files sit behind sign-in, so nothing outside the site (a badge service, a raw link) can read them. */
export function isPrivateTenant(org: string, tenants: VisibilityIndex = index as VisibilityIndex): boolean {
  return Object.hasOwn(tenants, org) && tenants[org]?.visibility === "private";
}
