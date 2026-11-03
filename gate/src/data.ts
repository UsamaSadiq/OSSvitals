const DATA_PATH = /^\/data\/([a-z0-9][a-z0-9-]*)\/((?:views|maintenance)\/[A-Za-z0-9_.-]+\.json)$/;

export const DATA_PREFIX = "/data/";

export type DataKey = { kind: "key"; key: string } | { kind: "forbidden" } | { kind: "not_found" };

/** The bucket key for a data path, only ever under the org the host serves, so one private tenant never reads another's. */
export function dataKey(pathname: string, org: string): DataKey {
  const match = DATA_PATH.exec(pathname);
  if (!match) return { kind: "not_found" };
  const [, requestedOrg, file] = match;
  if (requestedOrg !== org) return { kind: "forbidden" };
  return { kind: "key", key: `${org}/${file}` };
}

function hasBody(object: R2Object | R2ObjectBody): object is R2ObjectBody {
  return "body" in object;
}

export async function serveObject(bucket: R2Bucket, key: string, request: Request): Promise<Response> {
  const object = await bucket.get(key, { onlyIf: request.headers });
  if (object === null) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", ETag: object.httpEtag });
  if (!hasBody(object)) return new Response(null, { status: 304, headers });
  return new Response(object.body, { headers });
}
