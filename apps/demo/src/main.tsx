import { AudioDirector } from "sigilkit/audio";
import { World, type WorldState } from "sigilkit";
import { connect } from "sigilkit/net/client";
import { placeholderActor } from "sigilkit/pixi";
import { GameProvider, GameShell, Stage, useRenderer, useWorld } from "sigilkit/react";
import "sigilkit/react/styles.css";
import { InkRunner } from "sigilkit/story";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { game } from "./game";
import story from "./story/main.ink";

// --- engine wiring: each piece is optional and swappable -------------------
const world = new World(game);
new InkRunner(world, story);
world.events.on("error", ({ error, context }) => console.error(`[${context}]`, error));
world.start();

// Drop .ogg files in public/audio/<key>.ogg (e.g. door, pour) and they just play.
const audio = new AudioDirector(world, { resolve: (key) => `/audio/${key}.ogg` });

// Multiplayer is opt-in: run `npm run dev:party` and open ?party=localhost:8787
const params = new URLSearchParams(location.search);
const partyHost = params.get("party");
if (partyHost) {
  const guest = sessionStorage.getItem("guest") ?? crypto.randomUUID().slice(0, 8);
  sessionStorage.setItem("guest", guest);
  const net = connect(world, { host: partyHost, query: () => ({ guest, name: `Guest ${guest.slice(0, 4)}` }) });
  net.events.on("chat", ({ name, text }) => console.info(`${name}: ${text}`));
}

// Placeholder art until real sprites exist; swap for sheetActor({...}) per key.
const COLORS: Record<string, number> = { wren: 0xf3d27a, moth: 0x9fe0d4 };
const actors = (sprite: string, id: string) =>
  placeholderActor(COLORS[sprite] ?? hashColor(id), sprite === "moth" ? 12 : 14);

// --- dev keys: D debug overlay, S save, L load ------------------------------
function DevKeys() {
  const renderer = useRenderer();
  const w = useWorld();
  useEffect(() => {
    let debug = true;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "d") renderer?.setDebug((debug = !debug));
      if (e.key === "s") store("sigilkit-save", JSON.stringify(w.serialize()));
      if (e.key === "l") {
        const raw = load("sigilkit-save");
        if (raw) w.load(JSON.parse(raw) as WorldState);
      }
      if (e.key === " " || e.key === "Enter") w.advance();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [renderer, w]);
  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameProvider world={world}>
      <DevKeys />
      <GameShell
        stage={<Stage actors={actors} debug background={0x0d1412} onFirstGesture={() => void audio.unlock()} />}
      />
    </GameProvider>
  </StrictMode>,
);

function hashColor(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return (h & 0x7f7f7f) | 0x404040;
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode); saving is best-effort in the demo */
  }
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
