import { lazy, Suspense } from "react";
import { SiteFooter, SiteNav } from "./components/SiteChrome";
import { DocPage } from "./pages/DocPage";
import { LearnIndex } from "./pages/LearnIndex";
import { NotFound } from "./pages/NotFound";
import { navigate, usePath } from "./router";
import { useEffect } from "react";

// Pages with a live game load Pixi; keep it out of the docs pages' bundle.
const Landing = lazy(() => import("./pages/Landing").then((module) => ({ default: module.Landing })));
const LessonPage = lazy(() => import("./pages/LessonPage").then((module) => ({ default: module.LessonPage })));

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

function Route({ path }: { path: string }) {
  const [, section, slug, ...rest] = path.split("/");
  if (rest.length) return <NotFound />;
  if (path === "/") return <Landing />;
  if (section === "docs") return slug ? <DocPage slug={slug} /> : <Redirect to="/docs/introduction" />;
  if (section === "learn") return slug ? <LessonPage slug={slug} /> : <LearnIndex />;
  return <NotFound />;
}

export function App() {
  const path = usePath();
  return (
    <>
      <SiteNav />
      <Suspense fallback={<div className="page-loading" />}>
        <Route path={path} />
      </Suspense>
      <SiteFooter />
    </>
  );
}
