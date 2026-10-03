import { game } from "sigilkit-demo/game";
import { createPartyHandler, createRoomServer, guestVerifier, type AuthVerifier } from "sigilkit/net/server";

/**
 * One Durable Object per game room. The class name must match the binding in
 * wrangler.jsonc; clients use the kebab-case form ("Rooms" -> party "rooms").
 */
export const Rooms = createRoomServer(game);

/*
 * Auth. Guests in dev; Better Auth in production. With Better Auth running in
 * this Worker:
 *
 *   import { betterAuth } from "better-auth";
 *   import { betterAuthVerifier } from "sigilkit/net/server";
 *   const auth = betterAuth({ ...your config, plugins: [bearer()] });
 *   const verify = betterAuthVerifier(auth);
 *
 * Or against a separate auth service: betterAuthRemoteVerifier("https://auth.example.com").
 */
const verify: AuthVerifier = guestVerifier;
const route = createPartyHandler(verify);

export default {
  async fetch(request: Request, env: Cloudflare.Env): Promise<Response> {
    return (await route(request, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Cloudflare.Env>;
