import type { WorldEvents } from "sigilkit";
import { useWorld } from "sigilkit/react";
import { useEffect, useState } from "react";

const LOGGED_EVENTS: (keyof WorldEvents)[] = [
  "roomChanged",
  "walk",
  "flag",
  "music",
  "sfx",
  "areaChanged",
  "areaRevealed",
  "walkableChanged",
  "actorAdded",
  "actorRemoved",
  "error",
];

interface LogEntry {
  id: number;
  time: number;
  name: string;
  detail: string;
}

function describe(name: keyof WorldEvents, value: unknown): string {
  const event = value as Record<string, unknown>;
  switch (name) {
    case "roomChanged":
      return `${(event.room as { id: string }).id}`;
    case "walk": {
      const to = event.to as { x: number; y: number; level?: string };
      return `${event.actor} → ${to.x},${to.y}${to.level && to.level !== "ground" ? ` (${to.level})` : ""}`;
    }
    case "flag":
      return `${event.name} = ${JSON.stringify(event.value)}`;
    case "music":
      return `${event.key ?? "(silence)"}`;
    case "sfx":
      return `${event.key}`;
    case "areaChanged":
      return `${event.previous ?? "outside"} → ${event.area ?? "outside"}`;
    case "areaRevealed":
      return `${event.area}`;
    case "walkableChanged":
      return (event.tiles as { x: number; y: number }[]).map((tile) => `${tile.x},${tile.y}`).join(" ");
    case "error":
      return `${event.context}: ${event.error instanceof Error ? event.error.message : String(event.error)}`;
    default:
      return JSON.stringify(event);
  }
}

/** Live readout of the world: where the player is, flags, inventory, and recent events. */
export function Inspector() {
  const world = useWorld();
  const [, setTick] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [tab, setTab] = useState<"state" | "events">("state");

  useEffect(() => {
    let nextId = 0;
    const offs = LOGGED_EVENTS.map((name) =>
      world.events.on(name, (value) =>
        setLog((entries) => [{ id: nextId++, time: world.time, name: String(name), detail: describe(name, value) }, ...entries].slice(0, 40)),
      ),
    );
    const timer = setInterval(() => setTick((tick) => tick + 1), 200);
    return () => {
      offs.forEach((off) => off());
      clearInterval(timer);
    };
  }, [world]);

  const ui = world.ui.get();
  const player = world.state.actors[world.player];
  const area = player ? world.areaOf() : null;
  const flags = Object.entries(world.state.flags);

  return (
    <div className="inspector">
      <div className="inspector-tabs" role="tablist" aria-label="Inspector">
        <button type="button" role="tab" aria-selected={tab === "state"} onClick={() => setTab("state")}>
          State
        </button>
        <button type="button" role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}>
          Events{log.length ? <span className="count">{log.length}</span> : null}
        </button>
      </div>
      {tab === "state" ? (
        <dl className="inspector-state">
          <div>
            <dt>room</dt>
            <dd>{world.room.id}</dd>
          </div>
          {player && (
            <div>
              <dt>player</dt>
              <dd>
                {world.tileOf(world.player).x},{world.tileOf(world.player).y}
                {world.layout.isMultiLevel ? ` · ${world.levelOf(world.player)}` : ""} · {player.facing}
              </dd>
            </div>
          )}
          {world.room.areas?.length ? (
            <div>
              <dt>area</dt>
              <dd>{area?.id ?? "outside"}</dd>
            </div>
          ) : null}
          <div>
            <dt>verb</dt>
            <dd>
              {ui.heldItem ? `use ${ui.heldItem} with…` : ui.verb}
              {ui.busy ? <span className="badge">busy</span> : null}
            </dd>
          </div>
          <div>
            <dt>inventory</dt>
            <dd>{ui.inventory.length ? ui.inventory.join(", ") : <span className="muted">empty</span>}</dd>
          </div>
          <div className="wide">
            <dt>flags</dt>
            <dd>
              {flags.length ? (
                <ul className="flag-list">
                  {flags.map(([name, value]) => (
                    <li key={name} data-on={Boolean(value) || undefined}>
                      {name} <b>{JSON.stringify(value)}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="muted">none</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <ol className="inspector-log" aria-live="off">
          {log.length === 0 && <li className="muted">Walk around or click something.</li>}
          {log.map((entry) => (
            <li key={entry.id} data-event={entry.name}>
              <span className="event-time">{(entry.time / 1000).toFixed(1)}s</span>
              <span className="event-name">{entry.name}</span>
              <span className="event-detail">{entry.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
