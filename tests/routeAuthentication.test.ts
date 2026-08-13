import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * `requireApiPermission` short-circuits whenever `isTestRuntime()` holds, which
 * keeps every other suite from having to mint a session. That also means the
 * front door of the application is the one thing the suite never exercises, so
 * this file removes the marker for its own duration and drives the real path.
 * `isTestRuntime` reads the environment on each call, and Vitest runs test
 * files one at a time here, so nothing else observes the change.
 */
const vitestMarker = process.env.VITEST;

beforeAll(() => {
  delete process.env.VITEST;
});

afterAll(() => {
  process.env.VITEST = vitestMarker;
});

type RouteModuleLoader = () => Promise<Record<string, unknown>>;

/**
 * Discovering the handlers rather than listing them is the point: a route
 * added later joins this sweep without anyone remembering to enrol it. The
 * assertion describes what the glob returns, which its own types do not.
 */
const routeModules = import.meta.glob("../app/api/**/route.ts") as Record<string, RouteModuleLoader>;

/**
 * Reachable without a session by design. Everything absent from this list is
 * required to reject an anonymous caller, so adding a route here is a visible
 * decision rather than an omission.
 */
const PUBLIC_ROUTES = new Set([
  "audit-requests",
  "health",
  "integrations/oauth/[provider]/callback",
  "leads",
  "webhooks/[connectionId]",
  "webhooks/clerk"
]);

const HTTP_METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

function routeName(modulePath: string) {
  return modulePath.replace("../app/api/", "").replace("/route.ts", "");
}

function parametersFor(name: string) {
  const parameters: Record<string, string> = {};

  for (const segment of name.split("/")) {
    if (segment.startsWith("[")) parameters[segment.slice(1, -1)] = "00000000-0000-4000-8000-000000000001";
  }

  return parameters;
}

function anonymousRequest(name: string, method: string) {
  const url = `http://local.test/api/${name}`;
  const headers: Record<string, string> = { host: "local.test", origin: "http://local.test" };

  if (method === "GET") return new Request(url, { method, headers });

  return new Request(url, { method, headers: { ...headers, "content-type": "application/json" }, body: "{}" });
}

/**
 * Returns the methods that answered an anonymous caller with something other
 * than "unauthenticated" or "forbidden", so a failure names the exact verb
 * that let the caller through and the status it returned.
 */
async function methodsReachableWithoutSession(modulePath: string) {
  const routeModule = await routeModules[modulePath]();
  const name = routeName(modulePath);
  const params = Promise.resolve(parametersFor(name));
  const reachable: string[] = [];

  for (const method of HTTP_METHODS) {
    const handler = routeModule[method];

    if (typeof handler !== "function") continue;

    const respond = handler as (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
    const response = await respond(anonymousRequest(name, method), { params });

    if (response.status !== 401 && response.status !== 403) reachable.push(`${method} responded ${response.status}`);
  }

  return reachable;
}

const protectedRoutes = Object.keys(routeModules)
  .filter((modulePath) => !PUBLIC_ROUTES.has(routeName(modulePath)))
  .sort();

describe("every organization-scoped route handler authenticates before it acts", () => {
  /**
   * A new protected route joins the sweep on its own. Widening the allowlist
   * is the change worth noticing, so the size is stated here and a renamed or
   * deleted route cannot leave a stale entry silently excusing nothing.
   */
  it("keeps the public allowlist to six routes that still exist", () => {
    const onDisk = new Set(Object.keys(routeModules).map(routeName));

    expect([...PUBLIC_ROUTES].filter((name) => !onDisk.has(name))).toEqual([]);
    expect(PUBLIC_ROUTES.size).toBe(6);
  });

  it.each(protectedRoutes)("%s rejects an anonymous caller on every method it exports", async (modulePath) => {
    expect(await methodsReachableWithoutSession(modulePath)).toEqual([]);
  });
});
