/*
 * The site's structure as plain data: the docs navigation and the lesson list.
 * Both the app and vite.config.ts read it (the build writes a static page for
 * every route here), so it imports nothing.
 */

export interface DocEntry {
  slug: string;
  title: string;
  /** Markdown outside apps/docs (the repository's own guides), relative to the repo root. */
  repoFile?: string;
}

export interface DocSection {
  title: string;
  pages: DocEntry[];
}

export const DOC_SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      { slug: "introduction", title: "Introduction" },
      { slug: "installation", title: "Installation" },
      { slug: "quick-start", title: "Quick start" },
    ],
  },
  {
    title: "The world",
    pages: [
      { slug: "games-and-worlds", title: "Games and the World" },
      { slug: "rooms", title: "Rooms and walkmaps" },
      { slug: "actors", title: "Actors and movement" },
      { slug: "hotspots-and-verbs", title: "Hotspots and verbs" },
      { slug: "items-and-flags", title: "Items, inventory and flags" },
      { slug: "commands", title: "Commands" },
      { slug: "levels-and-areas", title: "Levels, stairs and areas" },
      { slug: "doors", title: "Doors and walkability" },
      { slug: "save-and-load", title: "Saving and loading" },
    ],
  },
  {
    title: "Modules",
    pages: [
      { slug: "story", title: "Story with Ink" },
      { slug: "rendering", title: "Rendering (Pixi)" },
      { slug: "react", title: "React UI" },
      { slug: "input", title: "Gamepad and keyboard" },
      { slug: "audio", title: "Audio" },
      { slug: "multiplayer", title: "Multiplayer" },
    ],
  },
  {
    title: "Guides",
    pages: [
      { slug: "testing", title: "Testing headlessly" },
      { slug: "level-design", title: "Designing a room", repoFile: "docs/LEVEL_DESIGN.md" },
      { slug: "visual-design", title: "Visual design", repoFile: "docs/VISUAL_DESIGN.md" },
      { slug: "audio-design", title: "Audio design", repoFile: "docs/AUDIO_DESIGN.md" },
      { slug: "architecture", title: "Architecture", repoFile: "docs/ARCHITECTURE.md" },
    ],
  },
  {
    title: "Reference",
    pages: [{ slug: "api", title: "API reference" }],
  },
];

export const ALL_DOCS: DocEntry[] = DOC_SECTIONS.flatMap((section) => section.pages);

export interface LessonEntry {
  slug: string;
  title: string;
  summary: string;
}

export interface LessonChapter {
  title: string;
  blurb: string;
  lessons: LessonEntry[];
}

export const LESSON_CHAPTERS: LessonChapter[] = [
  {
    title: "First steps",
    blurb: "A room, something to click, someone to talk to.",
    lessons: [
      { slug: "first-room", title: "A room to walk in", summary: "Walkmaps, the blockout and point-and-click movement." },
      { slug: "hotspots", title: "Hotspots and verbs", summary: "Clickable things, verb handlers and fallbacks." },
      { slug: "ink-dialog", title: "Talking with Ink", summary: "Spoken lines, narration and choices from an Ink story." },
      { slug: "items", title: "Items and inventory", summary: "Picking things up and using one thing with another." },
      { slug: "flags", title: "Flags and conditions", summary: "Story state that gates hotspots and branches dialog." },
    ],
  },
  {
    title: "Directing scenes",
    blurb: "Make characters move on cue and the story travel.",
    lessons: [
      { slug: "commands", title: "Commands and cutscenes", summary: "Walk, face, wait and your own commands, in sequence." },
      { slug: "rooms", title: "Moving between rooms", summary: "Entries, goto, onEnter and per-room music." },
      { slug: "isometric", title: "Isometric rooms", summary: "The same walkmap, seen as a diamond grid." },
    ],
  },
  {
    title: "Building spaces",
    blurb: "Floors stacked on floors, rooms you discover, doors that shut.",
    lessons: [
      { slug: "levels", title: "Levels and stairs", summary: "Raised floors, stairs between them, and headroom." },
      { slug: "areas", title: "Interiors and fog", summary: "Cutaway walls and rooms hidden until you enter." },
      { slug: "doors", title: "Doors and walkability", summary: "Tiles that open and shut while people walk." },
    ],
  },
  {
    title: "Presentation",
    blurb: "Everything the player sees and hears, on your terms.",
    lessons: [
      { slug: "props-and-layers", title: "Props and effect layers", summary: "Animated scenery and particles that depth-sort." },
      { slug: "custom-ui", title: "Your own UI", summary: "Replace the default interface using the same hooks." },
      { slug: "input", title: "Keyboard and gamepad", summary: "Couch controls: stick walking, focus and prompts." },
      { slug: "audio", title: "Music and sound", summary: "Crossfading room music, sound effects and ducking." },
    ],
  },
  {
    title: "Shipping",
    blurb: "Keep progress, prove it works, and invite friends.",
    lessons: [
      { slug: "save-load", title: "Saving and loading", summary: "The whole game as a small JSON object." },
      { slug: "testing", title: "Testing headlessly", summary: "Play a scene in code and assert on the outcome." },
      { slug: "multiplayer", title: "Shared presence", summary: "How multiplayer mirrors walks between players." },
    ],
  },
];

export const ALL_LESSONS: LessonEntry[] = LESSON_CHAPTERS.flatMap((chapter) => chapter.lessons);

/** Every path the static build writes a page for (without the base path). */
export const STATIC_ROUTES: string[] = [
  "/",
  "/docs",
  "/learn",
  ...ALL_DOCS.map((doc) => `/docs/${doc.slug}`),
  ...ALL_LESSONS.map((lesson) => `/learn/${lesson.slug}`),
];

export const REPOSITORY_URL = "https://github.com/therebelrobot/sigilkit";
export const NPM_URL = "https://www.npmjs.com/package/sigilkit";
