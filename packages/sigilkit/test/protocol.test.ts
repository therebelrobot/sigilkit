import { describe, expect, it } from "vitest";
import { betterAuthVerifier, guestVerifier, IDENTITY_HEADER, parseClientMessage } from "../src/net/index";

describe("protocol", () => {
  it("accepts well-formed intents", () => {
    expect(parseClientMessage(JSON.stringify({ t: "walk", to: { x: 2, y: 3 } }))).toEqual({ t: "walk", to: { x: 2, y: 3 } });
    expect(parseClientMessage(JSON.stringify({ t: "chat", text: "  hi  " }))).toEqual({ t: "chat", text: "hi" });
  });

  it("rejects junk", () => {
    expect(parseClientMessage("nope")).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "walk", to: { x: 1.5, y: 0 } }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "teleport" }))).toBeNull();
    expect(parseClientMessage(JSON.stringify({ t: "chat", text: "   " }))).toBeNull();
    expect(parseClientMessage("x".repeat(5000))).toBeNull();
  });

  it("caps chat length", () => {
    const m = parseClientMessage(JSON.stringify({ t: "chat", text: "a".repeat(1000) }));
    expect(m && m.t === "chat" && m.text.length).toBe(280);
  });
});

describe("guestVerifier", () => {
  it("derives a sanitized id and rejects anonymous", async () => {
    expect(await guestVerifier(new Request("https://x.test/?guest=a<b>c&name=Wren"))).toEqual({ id: "guest-abc", name: "Wren" });
    expect(await guestVerifier(new Request("https://x.test/"))).toBeNull();
  });
});

describe("betterAuthVerifier", () => {
  const seen: Headers[] = [];
  const auth = {
    api: {
      getSession: async ({ headers }: { headers: Headers }) => {
        seen.push(headers);
        return headers.get("authorization") === "Bearer good" ? { user: { id: "u1", name: "Aster" } } : null;
      },
    },
  };

  it("promotes a ?token to a bearer header and strips spoofed identity", async () => {
    const req = new Request("https://x.test/parties/rooms/cabin?token=good", {
      headers: { [IDENTITY_HEADER]: JSON.stringify({ id: "admin", name: "x" }) },
    });
    expect(await betterAuthVerifier(auth)(req)).toEqual({ id: "u1", name: "Aster" });
    expect(seen.at(-1)!.has(IDENTITY_HEADER)).toBe(false);
  });

  it("rejects without a session", async () => {
    expect(await betterAuthVerifier(auth)(new Request("https://x.test/?token=bad"))).toBeNull();
  });
});
