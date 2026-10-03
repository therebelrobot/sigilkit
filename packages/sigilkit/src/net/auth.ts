import { IDENTITY_HEADER, type Identity } from "./protocol";

/** Decide who a connecting request is. Return null to reject with 401. */
export type AuthVerifier = (request: Request) => Promise<Identity | null>;

/** The slice of a Better Auth instance we use (`betterAuth({...})`). */
export interface BetterAuthLike {
  api: {
    getSession(opts: { headers: Headers }): Promise<{ user: { id: string; name?: string | null; image?: string | null } } | null>;
  };
}

/**
 * Better Auth running in the same Worker. Browsers can't set headers on a
 * WebSocket, so a `token` query param (from Better Auth's bearer plugin) is
 * promoted to an Authorization header; same-origin cookie sessions work as-is.
 */
export function betterAuthVerifier(auth: BetterAuthLike): AuthVerifier {
  return async (request) => {
    const session = await auth.api.getSession({ headers: withBearerFromQuery(request) });
    if (!session?.user) return null;
    return { id: session.user.id, name: session.user.name || "Traveller" };
  };
}

/** Better Auth on another service: forwards cookies/token to its get-session endpoint. */
export function betterAuthRemoteVerifier(baseURL: string, basePath = "/api/auth"): AuthVerifier {
  return async (request) => {
    const res = await fetch(new URL(`${basePath}/get-session`, baseURL), { headers: withBearerFromQuery(request) });
    if (!res.ok) return null;
    const session = (await res.json()) as { user?: { id: string; name?: string } } | null;
    if (!session?.user) return null;
    return { id: session.user.id, name: session.user.name || "Traveller" };
  };
}

/** Development only: anyone may join, identified by a `guest` query param. */
export const guestVerifier: AuthVerifier = async (request) => {
  const url = new URL(request.url);
  const raw = url.searchParams.get("guest") ?? "";
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return id ? { id: `guest-${id}`, name: url.searchParams.get("name")?.slice(0, 24) || "Guest" } : null;
};

function withBearerFromQuery(request: Request): Headers {
  const headers = new Headers(request.headers);
  headers.delete(IDENTITY_HEADER);
  const token = new URL(request.url).searchParams.get("token");
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  return headers;
}
