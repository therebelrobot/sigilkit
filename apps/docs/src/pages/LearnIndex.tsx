import { ArrowIcon } from "../components/Icons";
import { Link } from "../router";
import { ALL_LESSONS, LESSON_CHAPTERS } from "../site";

export function LearnIndex() {
  return (
    <main className="learn-index" id="main">
      <header className="learn-hero">
        <p className="eyebrow">Learn sigilkit</p>
        <h1>Build an adventure, one idea at a time.</h1>
        <p className="lede">
          {ALL_LESSONS.length} short lessons, each with a game running beside the text. Read the source, change the story or the
          walkmap, press Run and see what happens. Nothing to install.
        </p>
        <div className="hero-actions">
          <Link to={`/learn/${ALL_LESSONS[0]!.slug}`} className="button primary">
            Start with lesson 1 <ArrowIcon />
          </Link>
          <Link to="/docs/quick-start" className="button">
            Set up a project instead
          </Link>
        </div>
      </header>
      <ol className="chapter-list">
        {LESSON_CHAPTERS.map((chapter, chapterIndex) => (
          <li key={chapter.title} className="chapter">
            <div className="chapter-heading">
              <span className="chapter-number">Chapter {chapterIndex + 1}</span>
              <h2>{chapter.title}</h2>
              <p className="muted">{chapter.blurb}</p>
            </div>
            <ol className="lesson-cards">
              {chapter.lessons.map((lesson) => {
                const number = ALL_LESSONS.indexOf(lesson) + 1;
                return (
                  <li key={lesson.slug}>
                    <Link to={`/learn/${lesson.slug}`} className="lesson-card">
                      <span className="lesson-card-number">{String(number).padStart(2, "0")}</span>
                      <span className="lesson-card-title">{lesson.title}</span>
                      <span className="lesson-card-summary">{lesson.summary}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ol>
    </main>
  );
}
