export function ownerPath(ownerKey: string): string {
  return `/ownership_views?${new URLSearchParams({ owner: ownerKey }).toString()}`;
}
