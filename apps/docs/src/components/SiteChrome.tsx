import { useEffect, useState } from "react";
import { ENGINE_VERSION } from "../content/registry";
import { Link, usePath } from "../router";
import { NPM_URL, REPOSITORY_URL } from "../site";
import { GithubIcon, MoonIcon, SearchIcon, SigilMark, SunIcon } from "./Icons";
import { Search } from "./Search";

const THEME_KEY = "sigilkit-docs-theme";

function useTheme(): ["light" | "dark", () => void] {
  const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
  const read = () => (document.documentElement.dataset.theme as "light" | "dark" | undefined) ?? (systemDark() ? "dark" : "light");
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(read());
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* storage unavailable; the choice lasts this visit */
    }
    setTheme(next);
  };
  return [theme, toggle];
}

export function SiteNav() {
  const path = usePath();
  const [theme, toggleTheme] = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      } else if (event.key === "/" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const section = path.split("/")[1];
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-nav">
        <Link to="/" className="brand" aria-label="sigilkit home">
          <SigilMark />
          <span className="wordmark">sigilkit</span>
          <span className="version">v{ENGINE_VERSION}</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <Link to="/docs/introduction" aria-current={section === "docs" ? "page" : undefined}>
            Docs
          </Link>
          <Link to="/learn" aria-current={section === "learn" ? "page" : undefined}>
            Learn
          </Link>
        </nav>
        <div className="nav-spacer" />
        <button type="button" className="search-button" onClick={() => setSearchOpen(true)} aria-label="Search">
          <SearchIcon />
          <span className="label">Search</span>
          <kbd>{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
        <a className="nav-icon github" href={REPOSITORY_URL} target="_blank" rel="noreferrer" aria-label="GitHub repository">
          <GithubIcon />
          <span className="label">GitHub</span>
        </a>
        <button type="button" className="nav-icon" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
      <Search open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>
          sigilkit is released into the public domain under the <a href="https://unlicense.org/">Unlicense</a>.
        </span>
        <nav aria-label="Footer">
          <Link to="/docs/introduction">Docs</Link>
          <Link to="/learn">Learn</Link>
          <a href={REPOSITORY_URL}>GitHub</a>
          <a href={NPM_URL}>npm</a>
        </nav>
      </div>
    </footer>
  );
}
