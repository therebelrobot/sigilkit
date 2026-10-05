import { game } from "sigilkit-demo/game";
import type { ReactNode } from "react";
import demoGame from "../../../demo/src/game.ts?code";
import demoStory from "../../../demo/src/story/main.ink?code";
import { ArrowIcon, SigilMark } from "../components/Icons";
import { Playground } from "../components/Playground";
import appSnippet from "../content/landing/app.md";
import installSnippet from "../content/landing/install.md";
import roomSnippet from "../content/landing/room.md";
import storySnippet from "../content/landing/story.md";
import { startWorld } from "../engine/session";
import { defineLesson } from "../lessons/types";
import { Link } from "../router";
import { ALL_LESSONS, LESSON_CHAPTERS, REPOSITORY_URL } from "../site";
import { handleContentClick } from "./DocPage";

/** The repository's own demo game, running from its own source. */
const demo = defineLesson({
  prose: { title: "", html: "", headings: [], sections: [] },
  files: [
    { name: "game.ts", language: "ts", file: demoGame },
    { name: "main.ink", language: "ink", file: demoStory, editable: true },
  ],
  start: async (sources) => ({ world: await startWorld(game, sources["main.ink"]) }),
});

const FEATURES: { title: string; body: ReactNode; glyph: string }[] = [
  {
    glyph: "◇",
    title: "Painted rooms, feet on a grid",
    body: "Backgrounds and hotspots live in pixel space; walking is grid pathfinding underneath. Art is never boxed into tiles.",
  },
  {
    glyph: "⬖",
    title: "Orthogonal or isometric",
    body: "Projection is one field on a room. The same walkmap, hotspots and scripts work in either, and rooms can switch mid-game.",
  },
  {
    glyph: "≋",
    title: "Floors, stairs and cutaways",
    body: "Stack levels, join them with stairs, and mark interiors whose front walls fade away while you're inside.",
  },
  {
    glyph: "❦",
    title: "Ink for every word",
    body: (
      <>
        Knots become handlers. <code>Moth: hello</code> is a spoken line, <code>&gt;&gt;&gt; walk wren 4 6</code> is a
        command, and VARs mirror world flags.
      </>
    ),
  },
  {
    glyph: "◎",
    title: "Mouse, touch, keyboard, pad",
    body: "Tap to walk, long-press for the verb coin, or play from the couch: stick walking, focus cycling, dialog on A.",
  },
  {
    glyph: "▣",
    title: "Blockout first",
    body: "Rooms without art draw themselves from the walkmap, so a game is playable before the first sprite exists.",
  },
  {
    glyph: "✓",
    title: "Headless and testable",
    body: "The World has no DOM. It runs in Vitest, in a Durable Object, or anywhere else, on world time rather than wall time.",
  },
  {
    glyph: "⇄",
    title: "Multiplayer when you want it",
    body: "An optional PartyServer room shares presence: the server pathfinds every walk; story stays per player.",
  },
];

const MODULES: { path: string; what: string; peer?: string }[] = [
  { path: "sigilkit", what: "The headless World: rooms, actors, movement, hotspots, verbs, inventory, flags, commands, save/load." },
  { path: "sigilkit/story", what: "Ink runner: knots as handlers, speaker lines, >>> commands, VARs mirrored to flags.", peer: "inkjs" },
  { path: "sigilkit/story/vite", what: "Vite plugin: import story from \"./main.ink\".", peer: "vite" },
  { path: "sigilkit/pixi", what: "PixiJS v8 renderer: backgrounds or blockout, depth sorting, picking, scaling, camera.", peer: "pixi.js" },
  { path: "sigilkit/react", what: "<Stage>, hooks and an unstyled default UI, with optional styles.", peer: "react" },
  { path: "sigilkit/input", what: "Gamepad and keyboard: stick walking, focus, dialog navigation, game-mode hooks." },
  { path: "sigilkit/audio", what: "Web Audio music crossfades, sound effects, ducking under dialog." },
  { path: "sigilkit/net", what: "Multiplayer room on PartyServer, partysocket client, Better Auth verifiers.", peer: "partyserver, partysocket" },
];

function Snippet({ html, label }: { html: string; label: string }) {
  return (
    <figure className="snippet">
      <figcaption>{label}</figcaption>
      <div onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  );
}

export function Landing() {
  return (
    <main className="landing" id="main">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <SigilMark size={16} /> A composable adventure engine for React
          </p>
          <h1>
            Adventure games,
            <br />
            <em>written as data.</em>
          </h1>
          <p className="lede">
            sigilkit is a point-and-click engine in the spirit of LucasArts' SCUMM. Rooms are data, story is Ink, and
            everything else is a small piece you can swap. It runs on desktop and phones, and with a controller.
          </p>
          <div className="hero-actions">
            <Link to="/learn" className="button primary">
              Start learning <ArrowIcon />
            </Link>
            <Link to="/docs/introduction" className="button">
              Read the docs
            </Link>
          </div>
          <div className="install" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: installSnippet.html }} />
        </div>
        <div className="hero-demo">
          <Playground lesson={demo} inspector={false} label="The sigilkit demo game" />
          <p className="hero-demo-caption">
            The repository's demo, running live. Click the floor to walk, and click Moth to talk. Use the verb bar to look,
            take or use things. <span className="muted">The story is editable: open main.ink.</span>
          </p>
        </div>
      </section>

      <section className="band">
        <header className="band-header">
          <p className="eyebrow">Content is data</p>
          <h2>A room, a story, an app. That's a game.</h2>
          <p className="lede">
            Rooms are typed objects. Story is Ink, which writers can edit in Inky. The app is a few lines of wiring, and
            any part of it can be replaced.
          </p>
        </header>
        <div className="snippets">
          <Snippet label="room.ts: where feet can go, and what's clickable" html={roomSnippet.html} />
          <Snippet label="main.ink: what everyone says and does" html={storySnippet.html} />
          <Snippet label="App.tsx: wiring, with every piece optional" html={appSnippet.html} />
        </div>
      </section>

      <section className="band">
        <header className="band-header">
          <p className="eyebrow">What's in the box</p>
          <h2>Everything an adventure needs. Nothing it doesn't.</h2>
        </header>
        <ul className="features">
          {FEATURES.map((feature) => (
            <li key={feature.title}>
              <span className="feature-glyph" aria-hidden="true">
                {feature.glyph}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band modules-band">
        <header className="band-header">
          <p className="eyebrow">One package</p>
          <h2>Import only what you use.</h2>
          <p className="lede">
            One name on npm, split into subpath exports. Everything beyond the core is an optional peer dependency, so a
            game that never touches multiplayer never installs it.
          </p>
          <Link to="/docs/api" className="text-link">
            Browse the API reference <ArrowIcon />
          </Link>
        </header>
        <ul className="modules">
          {MODULES.map((module) => (
            <li key={module.path}>
              <code>{module.path}</code>
              <span>{module.what}</span>
              {module.peer ? <span className="peer">needs {module.peer}</span> : <span className="peer none">no peers</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="band learn-band">
        <header className="band-header">
          <p className="eyebrow">Learn by playing</p>
          <h2>{ALL_LESSONS.length} lessons. A running game in every one.</h2>
          <p className="lede">
            Each lesson puts a small game beside the explanation. You can read its source, change its story or walkmap,
            and watch the world's state change as you play.
          </p>
        </header>
        <ol className="chapter-strip">
          {LESSON_CHAPTERS.map((chapter, index) => (
            <li key={chapter.title}>
              <Link to={`/learn/${chapter.lessons[0]!.slug}`}>
                <span className="chapter-number">Chapter {index + 1}</span>
                <strong>{chapter.title}</strong>
                <span className="muted">{chapter.lessons.map((lesson) => lesson.title).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="closing">
        <SigilMark size={44} />
        <h2>Write the story. sigilkit handles the walking.</h2>
        <div className="hero-actions">
          <Link to="/docs/quick-start" className="button primary">
            Quick start <ArrowIcon />
          </Link>
          <a href={REPOSITORY_URL} className="button">
            View on GitHub
          </a>
        </div>
      </section>
    </main>
  );
}
