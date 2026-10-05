import { useEffect, useState } from "react";
import { Playground } from "../components/Playground";
import type { Lesson } from "../lessons/types";
import { Link } from "../router";
import { ALL_LESSONS, LESSON_CHAPTERS } from "../site";
import { handleContentClick } from "./DocPage";
import { NotFound } from "./NotFound";

const lessonModules = import.meta.glob<Lesson>("../lessons/*/index.tsx", { import: "default" });

export function LessonPage({ slug }: { slug: string }) {
  const entry = ALL_LESSONS.find((lesson) => lesson.slug === slug);
  const [lesson, setLesson] = useState<{ slug: string; lesson: Lesson } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = lessonModules[`../lessons/${slug}/index.tsx`];
    void load?.().then((loaded) => {
      if (!cancelled) setLesson({ slug, lesson: loaded });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!entry || !lessonModules[`../lessons/${slug}/index.tsx`]) return <NotFound />;
  const index = ALL_LESSONS.indexOf(entry);
  const previous = ALL_LESSONS[index - 1];
  const next = ALL_LESSONS[index + 1];
  const chapter = LESSON_CHAPTERS.find((candidate) => candidate.lessons.includes(entry))!;
  const loaded = lesson?.slug === slug ? lesson.lesson : null;

  return (
    <main className="lesson-layout" id="main">
      <div className="lesson-intro">
        <nav className="lesson-progress" aria-label="Lessons">
          <Link to="/learn">Learn</Link>
          <span aria-hidden="true">›</span>
          <span>
            Lesson {index + 1} of {ALL_LESSONS.length}
          </span>
          <span className="dots">
            {ALL_LESSONS.map((lessonEntry, dotIndex) => (
              <Link
                key={lessonEntry.slug}
                to={`/learn/${lessonEntry.slug}`}
                aria-label={`Lesson ${dotIndex + 1}: ${lessonEntry.title}`}
                aria-current={lessonEntry.slug === slug ? "page" : undefined}
              />
            ))}
          </span>
        </nav>
        <header className="page-header">
          <p className="eyebrow">{chapter.title}</p>
          <h1>{entry.title}</h1>
          <p className="lede">{entry.summary}</p>
        </header>
      </div>
      <div className="lesson-stage">{loaded ? <Playground key={slug} lesson={loaded} /> : <div className="pg-loading playground">Loading…</div>}</div>
      <div className="lesson-prose">
        {loaded ? (
          <article className="prose" onClick={handleContentClick} dangerouslySetInnerHTML={{ __html: loaded.prose.html }} />
        ) : (
          <p className="muted">Loading the lesson…</p>
        )}
        <nav className="pager" aria-label="Previous and next lesson">
          {previous && (
            <Link to={`/learn/${previous.slug}`}>
              <span>Previous lesson</span>
              {previous.title}
            </Link>
          )}
          {next ? (
            <Link to={`/learn/${next.slug}`} className="next">
              <span>Next lesson</span>
              {next.title}
            </Link>
          ) : (
            <Link to="/docs/introduction" className="next">
              <span>All done</span>
              Read the docs
            </Link>
          )}
        </nav>
      </div>
    </main>
  );
}
