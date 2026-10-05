import type { World } from "sigilkit";
import type { Renderer } from "sigilkit/pixi";
import type { StageProps } from "sigilkit/react";
import type { ComponentType } from "react";
import type { CodeFile, MarkdownPage } from "../content/types";

export type FileLanguage = "ts" | "tsx" | "css" | "ink" | "walkmap";

export interface LessonFile {
  /** Shown on the tab, and the key in `sources`. */
  name: string;
  language: FileLanguage;
  file: CodeFile;
  /** Readers can edit it and press Run (Ink and walkmaps only; TypeScript isn't compiled in the browser). */
  editable?: boolean;
}

/** One running demo. The playground builds a fresh one on Run and Reset. */
export interface DemoSession {
  world: World;
  /** Extra <Stage> props (actors, props factory, overheadSpeech...). */
  stage?: Partial<StageProps>;
  /** Runs once the renderer exists (effect layers, debug hooks). Return a cleanup. */
  attach?: (renderer: Renderer) => void | (() => void);
  /** Replaces the default UI under the stage (inside GameProvider). */
  ui?: ComponentType;
  /** Buttons and readouts shown in the playground's toolbar (inside GameProvider). */
  controls?: ComponentType;
  /** Replaces the whole game view, for demos that aren't one stage (inside GameProvider). */
  view?: ComponentType;
  /** Set false for lessons that start their own input drivers. */
  input?: boolean;
  dispose?: () => void;
}

export interface Lesson {
  prose: MarkdownPage;
  files: LessonFile[];
  start: (sources: Record<string, string>) => DemoSession | Promise<DemoSession>;
}

export const defineLesson = (lesson: Lesson): Lesson => lesson;
