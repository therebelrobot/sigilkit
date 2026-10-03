import type { UiState, Vec2, World } from "../core/index";
import { createRenderer, type Renderer, type RendererOptions } from "../pixi/index";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

// ------------------------------------------------------------------ context

interface GameContext {
  world: World;
  renderer: Renderer | null;
  setRenderer: (r: Renderer | null) => void;
  /** Open verb coin, set by long-press / right-click. */
  coin: { room: Vec2; client: Vec2 } | null;
  setCoin: (c: { room: Vec2; client: Vec2 } | null) => void;
}

const Ctx = createContext<GameContext | null>(null);

export function GameProvider({ world, children }: { world: World; children: ReactNode }) {
  const [renderer, setRenderer] = useState<Renderer | null>(null);
  const [coin, setCoin] = useState<GameContext["coin"]>(null);
  return <Ctx.Provider value={{ world, renderer, setRenderer, coin, setCoin }}>{children}</Ctx.Provider>;
}

function useGame(): GameContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("sigilkit hooks must be used inside <GameProvider>");
  return c;
}

// -------------------------------------------------------------------- hooks

export const useWorld = (): World => useGame().world;
export const useRenderer = (): Renderer | null => useGame().renderer;

/** Subscribe to the world's UI snapshot (dialog, choices, verb, inventory, hover, busy). */
export function useUi(): UiState {
  const world = useWorld();
  return useSyncExternalStore(world.ui.subscribe, world.ui.get, world.ui.get);
}

export function useDialog() {
  const world = useWorld();
  const { line, choices } = useUi();
  return {
    line,
    choices,
    advance: useCallback(() => world.advance(), [world]),
    choose: useCallback((i: number) => world.choose(i), [world]),
  };
}

export function useVerbs() {
  const world = useWorld();
  const { verb } = useUi();
  return { verbs: world.verbs, verb, setVerb: useCallback((v: string) => world.setVerb(v), [world]) };
}

export function useInventory() {
  const world = useWorld();
  const { inventory, heldItem } = useUi();
  return {
    items: inventory.map((id) => ({ id, ...(world.game.items?.[id] ?? { name: id, icon: id }) })),
    held: heldItem,
    hold: useCallback((id: string | null) => world.holdItem(id), [world]),
  };
}

// -------------------------------------------------------------------- stage

export type StageProps = Omit<RendererOptions, "host" | "onAltPress"> & {
  className?: string;
  style?: CSSProperties;
  /** First user gesture; resume audio here. */
  onFirstGesture?: () => void;
  /** Replace the verb coin with your own alt-press handling. */
  onAltPress?: RendererOptions["onAltPress"];
};

/** Mounts the Pixi renderer into a div that fills its parent. */
export function Stage({ className, style, onFirstGesture, onAltPress, ...options }: StageProps) {
  const { world, setRenderer, setCoin } = useGame();
  const host = useRef<HTMLDivElement>(null);
  const opts = useRef(options);
  opts.current = options;
  const gestured = useRef(false);

  useEffect(() => {
    let disposed = false;
    let r: Renderer | null = null;
    void createRenderer(world, {
      ...opts.current,
      host: host.current!,
      onAltPress: onAltPress ?? ((room, client) => setCoin({ room, client })),
    }).then((created) => {
      if (disposed) return created.destroy();
      r = created;
      setRenderer(created);
    });
    return () => {
      disposed = true;
      r?.destroy();
      setRenderer(null);
    };
    // Recreate only when the world changes; option changes go through the renderer API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  return (
    <div
      ref={host}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
      onPointerDown={() => {
        if (gestured.current) return;
        gestured.current = true;
        onFirstGesture?.();
      }}
    />
  );
}

// --------------------------------------------------------------- components
// Unstyled apart from layout essentials. Class names are stable `vc-*` hooks;
// import "sigilkit/react/styles.css" for defaults or write your own.

export function DialogBox({ className = "vc-dialog" }: { className?: string }) {
  const world = useWorld();
  const { line, advance } = useDialog();
  if (!line) return null;
  const speaker = line.speaker ? world.game.actors[line.speaker] : undefined;
  return (
    <button type="button" className={className} onClick={advance} aria-live="polite" data-speaker={line.speaker ?? undefined}>
      {speaker && (
        <span className="vc-dialog-speaker" style={{ color: speaker.color }}>
          {speaker.name}
        </span>
      )}
      <span className="vc-dialog-text">{line.text}</span>
    </button>
  );
}

export function ChoiceList({ className = "vc-choices" }: { className?: string }) {
  const { choices, choose } = useDialog();
  const { choiceIndex } = useUi();
  if (!choices.length) return null;
  return (
    <ol className={className}>
      {choices.map((c, i) => (
        <li key={c.index}>
          {/* aria-current marks the gamepad/keyboard cursor; pointer users just click. */}
          <button type="button" aria-current={i === choiceIndex || undefined} onClick={() => choose(c.index)}>
            {c.text}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function VerbBar({ className = "vc-verbs", labels }: { className?: string; labels?: Record<string, string> }) {
  const { verbs, verb, setVerb } = useVerbs();
  return (
    <div className={className} role="toolbar" aria-label="Verbs">
      {verbs.map((v) => (
        <button type="button" key={v} aria-pressed={v === verb} onClick={() => setVerb(v)}>
          {labels?.[v] ?? v}
        </button>
      ))}
    </div>
  );
}

export function InventoryBar({
  className = "vc-inventory",
  renderIcon,
}: {
  className?: string;
  renderIcon?: (item: { id: string; name: string; icon: string }) => ReactNode;
}) {
  const { items, held, hold } = useInventory();
  return (
    <div className={className} role="toolbar" aria-label="Inventory">
      {items.map((it) => (
        <button
          type="button"
          key={it.id}
          aria-pressed={held === it.id}
          title={it.name}
          onClick={() => hold(held === it.id ? null : it.id)}
        >
          {renderIcon ? renderIcon(it) : it.name}
        </button>
      ))}
    </div>
  );
}

/** "Use key with Door"-style sentence line. */
export function SentenceLine({ className = "vc-sentence" }: { className?: string }) {
  const world = useWorld();
  const { verb, hover, heldItem, focus } = useUi();
  const item = heldItem ? (world.game.items?.[heldItem]?.name ?? heldItem) : null;
  // Pointer hover wins; otherwise name what gamepad/keyboard focus is on.
  const focusName = focus ? (world.hotspots().find((h) => h.id === focus)?.name ?? world.game.actors[focus]?.name ?? null) : null;
  const target = hover ?? focusName;
  const text = item ? `Use ${item} with ${target ?? ""}` : verb === "walk" ? (target ?? "") : `${cap(verb)} ${target ?? ""}`;
  return <div className={className}>{text.trim() || " "}</div>;
}

/** Radial verb picker at the long-press / right-click point. */
export function VerbCoin({ className = "vc-coin", radius = 56 }: { className?: string; radius?: number }) {
  const { world, coin, setCoin } = useGame();
  if (!coin) return null;
  const verbs = world.verbs.filter((v) => v !== "walk");
  const pick = (v: string) => {
    setCoin(null);
    void world.activate(coin.room, v);
  };
  return (
    <div className={`${className}-backdrop`} style={{ position: "fixed", inset: 0, zIndex: 20 }} onPointerDown={() => setCoin(null)}>
      <div
        className={className}
        role="menu"
        style={{ position: "fixed", left: coin.client.x, top: coin.client.y, width: 0, height: 0 }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {verbs.map((v, i) => {
          const a = (i / verbs.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <button
              type="button"
              role="menuitem"
              key={v}
              onClick={() => pick(v)}
              style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${Math.cos(a) * radius}px, ${Math.sin(a) * radius}px)` }}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Default responsive layout: the stage letterboxes on top, UI docks below in
 * portrait and overlays the bottom edge in landscape. Pass your own children
 * to replace the default UI.
 */
export function GameShell({ stage, children }: { stage: ReactNode; children?: ReactNode }) {
  return (
    <div className="vc-shell">
      <div className="vc-shell-stage">{stage}</div>
      <div className="vc-shell-ui">
        {children ?? (
          <>
            <DialogBox />
            <ChoiceList />
            <SentenceLine />
            <VerbBar />
            <InventoryBar />
          </>
        )}
      </div>
      <VerbCoin />
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
