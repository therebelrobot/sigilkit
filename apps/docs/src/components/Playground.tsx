import { setInputMode, startGamepad, startKeyboard, trackPointerAndKeyboard } from "sigilkit/input";
import { GameProvider, GameShell, Stage, useRenderer, useWorld } from "sigilkit/react";
import "sigilkit/react/styles.css";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { placeholderActors } from "../engine/actors";
import { InkCompileError } from "../engine/compile-ink";
import type { DemoSession, Lesson } from "../lessons/types";
import { CodeEditor } from "./CodeEditor";
import { Inspector } from "./Inspector";

// The docs start in pointer mode, and switch with whatever the reader uses.
setInputMode("pointer");
trackPointerAndKeyboard();

const LETTERBOX = 0x070c0b;

type SourceMap = Record<string, string>;

const sourcesOf = (lesson: Lesson): SourceMap => Object.fromEntries(lesson.files.map((file) => [file.name, file.file.source]));

/**
 * A running lesson: the game, its source files (some editable), and an
 * inspector. Keyboard and gamepad only drive the game while it has focus, so
 * the page still scrolls with the arrow keys.
 */
export function Playground({ lesson, inspector = true, label = "Interactive demo" }: { lesson: Lesson; inspector?: boolean; label?: string }) {
  const [sources, setSources] = useState<SourceMap>(() => sourcesOf(lesson));
  const [ranSources, setRanSources] = useState<SourceMap>(sources);
  const [generation, setGeneration] = useState(0);
  const [session, setSession] = useState<DemoSession | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [tab, setTab] = useState("play");
  const [debug, setDebug] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let created: DemoSession | null = null;
    setErrors(null);
    setSession(null);
    Promise.resolve()
      .then(() => lesson.start(ranSources))
      .then((started) => {
        if (cancelled) return started.dispose?.();
        created = started;
        setSession(started);
        // The running world, for poking at in the console while developing.
        if (import.meta.env.DEV) Object.assign(globalThis, { __world: started.world });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setErrors(error instanceof InkCompileError ? error.messages : [error instanceof Error ? error.message : String(error)]);
        setSession(null);
      });
    return () => {
      cancelled = true;
      created?.dispose?.();
    };
  }, [lesson, ranSources, generation]);

  // Keyboard and gamepad apply while focus is inside the playground.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const update = () => {
      activeRef.current = root.contains(document.activeElement) && !(document.activeElement instanceof HTMLTextAreaElement);
      root.dataset.active = String(activeRef.current);
    };
    const updateAfterFocusMoves = () => requestAnimationFrame(update);
    root.addEventListener("focusin", update);
    root.addEventListener("focusout", updateAfterFocusMoves);
    return () => {
      root.removeEventListener("focusin", update);
      root.removeEventListener("focusout", updateAfterFocusMoves);
    };
  }, []);

  const dirty = useMemo(() => lesson.files.some((file) => sources[file.name] !== ranSources[file.name]), [lesson, sources, ranSources]);
  const edited = useMemo(() => lesson.files.some((file) => sources[file.name] !== file.file.source), [lesson, sources]);

  const run = () => {
    setRanSources({ ...sources });
    setGeneration((value) => value + 1);
    setTab("play");
  };
  const revert = () => {
    const original = sourcesOf(lesson);
    setSources(original);
    setRanSources(original);
    setGeneration((value) => value + 1);
  };

  const activeFile = lesson.files.find((file) => file.name === tab);

  return (
    <section className="playground" ref={rootRef} aria-label={label}>
      <div className="pg-toolbar">
        <div className="pg-tabs" role="tablist" aria-label="Demo and source files">
          <button type="button" role="tab" aria-selected={tab === "play"} onClick={() => setTab("play")}>
            <PlayIcon /> Play
          </button>
          {lesson.files.map((file) => (
            <button type="button" role="tab" key={file.name} aria-selected={tab === file.name} onClick={() => setTab(file.name)}>
              {file.name}
              {file.editable && <span className={sources[file.name] !== file.file.source ? "edit-dot edited" : "edit-dot"} title="Editable" />}
            </button>
          ))}
        </div>
        <div className="pg-actions">
          {dirty ? (
            <button type="button" className="pg-run" onClick={run} title="Run (⌘/Ctrl + Enter)">
              <PlayIcon /> Run
            </button>
          ) : null}
          {edited && (
            <button type="button" onClick={revert} title="Undo your edits">
              Revert
            </button>
          )}
          <button type="button" onClick={() => setGeneration((value) => value + 1)} title="Restart the demo">
            <RestartIcon /> Restart
          </button>
          <button type="button" aria-pressed={debug} onClick={() => setDebug((on) => !on)} title="Show the walkmap and hotspot outlines">
            Debug
          </button>
        </div>
      </div>

      <div className="pg-body">
        <div className="pg-game" data-hidden={tab !== "play" || undefined}>
          {session ? (
            <GameProvider key={generation} world={session.world}>
              {session.view ? (
                <session.view />
              ) : (
                <>
                  <GameShell
                    stage={<Stage actors={placeholderActors(session.world)} background={LETTERBOX} debug={debug} {...session.stage} />}
                  >
                    {session.ui ? <session.ui /> : undefined}
                  </GameShell>
                  <RendererHooks session={session} debug={debug} />
                  {session.input !== false && <ScopedInput activeRef={activeRef} />}
                </>
              )}
              {session.controls && (
                <div className="pg-controls">
                  <session.controls />
                </div>
              )}
              {inspector && <Inspector />}
            </GameProvider>
          ) : errors ? null : (
            <div className="pg-loading">Starting…</div>
          )}
          {errors && (
            <div className="pg-errors" role="alert">
              <p>The demo didn't start:</p>
              <ul>
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
              <p className="muted">Fix the file and press Run, or Revert to the original.</p>
            </div>
          )}
        </div>

        {activeFile && (
          <div className="pg-file">
            {activeFile.editable ? (
              <>
                <CodeEditor
                  label={`Edit ${activeFile.name}`}
                  language={activeFile.language}
                  value={sources[activeFile.name] ?? ""}
                  onChange={(value) => setSources((current) => ({ ...current, [activeFile.name]: value }))}
                  onRun={run}
                />
                <p className="pg-hint">Edit, then press Run (⌘/Ctrl + Enter).</p>
              </>
            ) : (
              <div className="pg-source" dangerouslySetInnerHTML={{ __html: activeFile.file.html }} />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RendererHooks({ session, debug }: { session: DemoSession; debug: boolean }) {
  const renderer = useRenderer();
  useEffect(() => {
    renderer?.setDebug(debug);
  }, [renderer, debug]);
  useEffect(() => {
    if (!renderer || !session.attach) return;
    const cleanup = session.attach(renderer);
    return () => cleanup?.();
  }, [renderer, session]);
  return null;
}

/** Keyboard and gamepad play, consumed only while the playground has focus. */
function ScopedInput({ activeRef }: { activeRef: RefObject<boolean> }) {
  const world = useWorld();
  useEffect(() => {
    const inactive = () => !activeRef.current;
    // Tab stays with the browser (leaving the demo); ] and [ cycle focus instead.
    const keyboard = startKeyboard(world, { bindings: { next: ["]"], prev: ["["] }, onKey: inactive });
    const gamepad = startGamepad(world, { onButton: inactive, onFrame: inactive });
    return () => {
      keyboard.stop();
      gamepad.stop();
    };
  }, [world, activeRef]);
  return null;
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 8a5 5 0 1 0 1.6-3.7" />
      <path d="M3 2.5v2.5h2.5" />
    </svg>
  );
}
