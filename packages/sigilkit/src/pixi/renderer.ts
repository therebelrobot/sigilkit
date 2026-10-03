import type { ActorView, HotspotDef, Projection, RoomDef, Vec2, World } from "../core/index";
import {
  Application,
  Assets,
  Container,
  FederatedPointerEvent,
  Graphics,
  Sprite,
  Text,
  Texture,
  TextureStyle,
  type ApplicationOptions,
} from "pixi.js";
import type { ActorDisplay, ActorFactory } from "./actors";

export type Scaling = "integer" | "fit" | "auto";

export interface RendererOptions {
  host: HTMLElement;
  /** Builds the display for each actor's sprite key. */
  actors: ActorFactory;
  /** Background/prop asset key -> URL. Rooms without a resolvable background get a blockout floor. */
  resolveAsset?: (key: string) => string | undefined;
  /**
   * integer: crisp pixel art, may leave wide borders.
   * fit: fill the host, fractional scale.
   * auto (default): integer when it reaches at least 2x, otherwise fit (small phones).
   */
  scaling?: Scaling;
  /** Letterbox color. */
  background?: number;
  /** Draw walkmap and hotspot outlines. */
  debug?: boolean;
  /**
   * Draw spoken lines above the speaker, SCUMM-style. Default false: the React
   * DialogBox is more readable on phones and reaches screen readers. Turn this on
   * and drop DialogBox (or keep it for narration only) for the classic look.
   */
  overheadSpeech?: boolean;
  fontFamily?: string;
  /** Called on touch long-press or mouse right-button, with room and client coordinates. Default: use "look". */
  onAltPress?: (room: Vec2, client: Vec2) => void;
  longPressMs?: number;
  pixi?: Partial<ApplicationOptions>;
}

export interface Renderer {
  readonly app: Application;
  readonly world: World;
  /** Client (DOM) coordinates to room pixels, or null if outside the game frame. */
  toRoom(clientX: number, clientY: number): Vec2 | null;
  /** Room pixels to client coordinates, for placing DOM overlays (verb coin, tooltips). */
  toClient(room: Vec2): Vec2;
  setDebug(on: boolean): void;
  destroy(): void;
}

export async function createRenderer(world: World, opts: RendererOptions): Promise<Renderer> {
  const { width: W, height: H } = world.game.resolution;
  TextureStyle.defaultOptions.scaleMode = "nearest";

  const app = new Application();
  await app.init({
    resizeTo: opts.host,
    background: opts.background ?? 0x000000,
    antialias: false,
    autoDensity: true,
    resolution: globalThis.devicePixelRatio ?? 1,
    roundPixels: true,
    ...opts.pixi,
  });
  opts.host.appendChild(app.canvas);
  app.canvas.style.display = "block";
  app.canvas.style.touchAction = "none";

  // frame: logical-resolution box, scaled and letterboxed into the host
  const frame = new Container();
  const mask = new Graphics().rect(0, 0, W, H).fill(0xffffff);
  const camera = new Container();
  const floor = new Container();
  const debugLayer = new Graphics();
  const entities = new Container({ sortableChildren: true });
  const speech = new Container();
  camera.addChild(floor, debugLayer, entities, speech);
  frame.addChild(mask, camera);
  frame.mask = mask;
  app.stage.addChild(frame);

  let scale = 1;
  const layout = () => {
    const sw = app.screen.width;
    const sh = app.screen.height;
    const fit = Math.min(sw / W, sh / H);
    const mode = opts.scaling ?? "auto";
    scale = mode === "fit" ? fit : mode === "integer" ? Math.max(1, Math.floor(fit)) : fit >= 2 ? Math.floor(fit) : fit;
    frame.scale.set(scale);
    frame.position.set(Math.round((sw - W * scale) / 2), Math.round((sh - H * scale) / 2));
  };
  app.renderer.on("resize", layout);
  layout();
  // Pixi's resizeTo only listens for window resizes; the host can also change size
  // when surrounding UI reflows (rotating a phone, panels opening).
  let destroyed = false;
  // Callbacks can already be queued when destroy() runs (React StrictMode remounts), so guard them.
  const resizeObserver = new ResizeObserver(() => {
    if (!destroyed) app.resize();
  });
  resizeObserver.observe(opts.host);

  // ------------------------------------------------------------------ room
  const displays = new Map<string, ActorDisplay>();
  const props: Sprite[] = [];
  const blocks: Graphics[] = [];
  let roomBounds = { x: 0, y: 0, width: W, height: H };
  let debug = opts.debug ?? false;

  const clearRoom = () => {
    for (const d of displays.values()) d.destroy();
    displays.clear();
    for (const p of props) p.destroy();
    props.length = 0;
    floor.removeChildren().forEach((c) => c.destroy());
    for (const b of blocks) b.destroy();
    blocks.length = 0;
  };

  const loadTexture = async (key: string): Promise<Texture | null> => {
    const url = opts.resolveAsset?.(key);
    if (!url) return null;
    try {
      return await Assets.load<Texture>(url);
    } catch {
      return null;
    }
  };

  const buildRoom = async (room: RoomDef, projection: Projection) => {
    if (destroyed) return;
    clearRoom();
    const grid = world.walkmap;
    roomBounds = room.size
      ? { x: 0, y: 0, ...room.size }
      : projection.bounds(grid.cols, grid.rows);
    const bg = room.background ? await loadTexture(room.background) : null;
    if (destroyed || world.room !== room) return; // destroyed or room changed while loading
    if (bg) {
      floor.addChild(new Sprite(bg));
      if (!room.size) roomBounds = { x: 0, y: 0, width: bg.width, height: bg.height };
    } else {
      const b = blockout(room, projection, grid);
      floor.addChild(b.floor);
      for (const g of b.blocks) {
        entities.addChild(g);
        blocks.push(g);
      }
    }
    for (const p of room.props ?? []) {
      const tex = await loadTexture(p.asset);
      if (!tex) continue;
      const s = new Sprite(tex);
      s.position.set(p.at.x, p.at.y);
      const foot = p.depthTile ? projection.tileToScreen(p.depthTile.x, p.depthTile.y).y : p.at.y + tex.height;
      s.zIndex = foot;
      entities.addChild(s);
      props.push(s);
    }
    drawDebug();
  };

  const drawDebug = () => {
    debugLayer.clear();
    if (!debug) return;
    const p = world.projection;
    const g = world.walkmap;
    for (let y = 0; y < g.rows; y++)
      for (let x = 0; x < g.cols; x++) {
        debugLayer.poly(tileOutline(p, x, y)).fill({ color: g.walkable(x, y) ? 0x40ff80 : 0xff4060, alpha: 0.18 });
      }
    for (const h of world.hotspots()) drawShape(debugLayer, h).stroke({ width: 1, color: 0xffe066, alpha: 0.9 });
  };

  const offRoom = world.events.on("roomChanged", ({ room, projection }) => void buildRoom(room, projection));
  await buildRoom(world.room, world.projection);

  // ---------------------------------------------------------------- speech
  const speechText = new Text({
    text: "",
    style: {
      fontFamily: opts.fontFamily ?? "monospace",
      fontSize: 8,
      fill: 0xffffff,
      align: "center",
      wordWrap: true,
      wordWrapWidth: Math.min(200, W * 0.7),
      stroke: { color: 0x000000, width: 2 },
      lineHeight: 9,
    },
  });
  speechText.anchor.set(0.5, 1);
  speech.addChild(speechText);

  const updateSpeech = (views: ActorView[]) => {
    const line = world.ui.get().line;
    const view = line?.speaker ? views.find((v) => v.id === line.speaker) : undefined;
    if (!(opts.overheadSpeech ?? false) || !line || !view) {
      speechText.visible = false;
      return;
    }
    if (speechText.text !== line.text) speechText.text = line.text;
    speechText.style.fill = world.game.actors[view.id]?.color ?? 0xffffff;
    speechText.resolution = scale * (globalThis.devicePixelRatio ?? 1);
    const [, h] = world.game.actors[view.id]?.hitbox ?? [0, world.room.tile.width * 2];
    // Keep the bubble inside the visible frame.
    const half = speechText.width / 2;
    const left = -camera.x + 2 + half;
    const right = -camera.x + W - 2 - half;
    speechText.position.set(Math.min(Math.max(view.screen.x, left), right), Math.max(view.screen.y - h - 2, -camera.y + speechText.height + 2));
    speechText.visible = true;
  };

  // ---------------------------------------------------------------- camera
  const follow = (views: ActorView[]) => {
    const target = views.find((v) => v.id === world.player)?.screen ?? { x: W / 2, y: H / 2 };
    const axis = (pos: number, min: number, size: number, view: number) =>
      size <= view ? min - (view - size) / 2 : Math.min(Math.max(pos - view / 2, min), min + size - view);
    camera.position.set(
      -Math.round(axis(target.x, roomBounds.x, roomBounds.width, W)),
      -Math.round(axis(target.y, roomBounds.y, roomBounds.height, H)),
    );
  };

  // ------------------------------------------------------------------ tick
  const tick = () => {
    const dt = app.ticker.deltaMS;
    world.update(dt);
    const views = world.actorViews();
    const seen = new Set<string>();
    for (const v of views) {
      seen.add(v.id);
      let d = displays.get(v.id);
      if (!d) {
        d = opts.actors(v.sprite, v.id);
        displays.set(v.id, d);
        entities.addChild(d.view);
      }
      d.view.visible = v.visible;
      d.view.position.set(Math.round(v.screen.x), Math.round(v.screen.y));
      d.view.zIndex = v.screen.y;
      d.update(v, dt);
    }
    for (const [id, d] of displays) {
      if (!seen.has(id)) {
        d.destroy();
        displays.delete(id);
      }
    }
    follow(views);
    updateSpeech(views);
  };
  app.ticker.add(tick);

  // ----------------------------------------------------------------- input
  const toRoomFromGlobal = (gx: number, gy: number): Vec2 | null => {
    const local = frame.toLocal({ x: gx, y: gy });
    if (local.x < 0 || local.y < 0 || local.x >= W || local.y >= H) return null;
    return camera.toLocal({ x: gx, y: gy });
  };
  const clientToGlobal = (cx: number, cy: number) => {
    const r = app.canvas.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };

  app.stage.eventMode = "static";
  app.stage.hitArea = app.screen;
  let press: { at: Vec2; client: Vec2; timer: ReturnType<typeof setTimeout> | null; alt: boolean } | null = null;
  const alt = (room: Vec2, client: Vec2) =>
    opts.onAltPress ? opts.onAltPress(room, client) : void world.activate(room, "look");

  app.stage.on("pointerdown", (e: FederatedPointerEvent) => {
    const at = toRoomFromGlobal(e.global.x, e.global.y);
    if (!at) return;
    const client = { x: e.clientX, y: e.clientY };
    if (e.button === 2) {
      alt(at, client);
      return;
    }
    press = { at, client, alt: false, timer: null };
    if (e.pointerType === "touch") {
      const p = press;
      p.timer = setTimeout(() => {
        p.alt = true;
        alt(p.at, p.client);
      }, opts.longPressMs ?? 450);
    }
  });
  app.stage.on("pointerup", (e: FederatedPointerEvent) => {
    if (!press) return;
    const p = press;
    press = null;
    if (p.timer) clearTimeout(p.timer);
    if (p.alt) return;
    const ui = world.ui.get();
    if (ui.line) return world.advance();
    if (ui.choices.length) return;
    const at = toRoomFromGlobal(e.global.x, e.global.y) ?? p.at;
    void world.activate(at);
  });
  app.stage.on("pointermove", (e: FederatedPointerEvent) => {
    if (press?.timer && Math.hypot(e.clientX - press.client.x, e.clientY - press.client.y) > 10) {
      clearTimeout(press.timer);
      press.timer = null;
    }
    if (e.pointerType === "mouse") world.hover(toRoomFromGlobal(e.global.x, e.global.y));
  });
  app.stage.on("pointerleave", () => world.hover(null));
  const noMenu = (e: Event) => e.preventDefault();
  app.canvas.addEventListener("contextmenu", noMenu);

  return {
    app,
    world,
    toRoom: (cx, cy) => {
      const g = clientToGlobal(cx, cy);
      return toRoomFromGlobal(g.x, g.y);
    },
    toClient: (room) => {
      const g = camera.toGlobal(room);
      const r = app.canvas.getBoundingClientRect();
      return { x: g.x + r.left, y: g.y + r.top };
    },
    setDebug: (on) => {
      debug = on;
      drawDebug();
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      offRoom();
      resizeObserver.disconnect();
      app.canvas.removeEventListener("contextmenu", noMenu);
      clearRoom();
      app.destroy(true, { children: true });
    },
  };
}

// ------------------------------------------------------------------ helpers

function tileOutline(p: Projection, x: number, y: number): number[] {
  if (p.kind === "isometric") {
    const t = p.tileToScreen(x - 0.5, y - 0.5); // top corner
    const r = p.tileToScreen(x + 0.5, y - 0.5);
    const b = p.tileToScreen(x + 0.5, y + 0.5);
    const l = p.tileToScreen(x - 0.5, y + 0.5);
    return [t.x, t.y, r.x, r.y, b.x, b.y, l.x, l.y];
  }
  const a = p.tileToScreen(x - 0.5, y - 0.5);
  const c = p.tileToScreen(x + 0.5, y + 0.5);
  return [a.x, a.y, c.x, a.y, c.x, c.y, a.x, c.y];
}

function drawShape(g: Graphics, h: HotspotDef): Graphics {
  if ("rect" in h.shape) return g.rect(...h.shape.rect);
  return g.poly(h.shape.polygon);
}

/**
 * Flat-shaded floor straight from the walkmap, for rooms without art yet.
 * Blocked isometric tiles become raised blocks that depth-sort with actors.
 */
function blockout(room: RoomDef, p: Projection, grid: World["walkmap"]): { floor: Graphics; blocks: Graphics[] } {
  const floor = new Graphics();
  const blocks: Graphics[] = [];
  const walk = [0x3b5b4a, 0x416551];
  const wall = 0x1d2a2a;
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++) {
      const pts = tileOutline(p, x, y);
      const open = grid.walkable(x, y);
      floor.poly(pts).fill(open ? walk[(x + y) % 2]! : wall);
      if (open || p.kind !== "isometric") continue;
      const lift = room.tile.height;
      const [tx, ty, rx, ry, bx, by, lx, ly] = pts as [number, number, number, number, number, number, number, number];
      const g = new Graphics()
        .poly([lx, ly, bx, by, bx, by - lift, lx, ly - lift])
        .fill(0x2a3d3a)
        .poly([bx, by, rx, ry, rx, ry - lift, bx, by - lift])
        .fill(0x223230)
        .poly([tx, ty - lift, rx, ry - lift, bx, by - lift, lx, ly - lift])
        .fill(0x35504a);
      // Sort by the tile centre, same key actors use, so a block in front of an actor covers it.
      g.zIndex = p.tileToScreen(x, y).y;
      blocks.push(g);
    }
  return { floor, blocks };
}
