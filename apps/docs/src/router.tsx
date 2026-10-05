import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

/*
 * A tiny history router. Paths inside the app never include the base
 * ("/docs/rooms"); hrefs do ("/sigilkit/docs/rooms" on GitHub Pages).
 */

const BASE = import.meta.env.BASE_URL;
const NAVIGATE_EVENT = "sigilkit-docs:navigate";

/** The app path for a URL pathname: base removed, no trailing slash. */
export function appPath(pathname: string): string {
  const withoutBase = pathname.startsWith(BASE) ? pathname.slice(BASE.length - 1) : pathname;
  const trimmed = withoutBase.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** The href for an app path, with the base in front. */
export function href(path: string): string {
  return BASE + path.replace(/^\//, "");
}

const subscribe = (onChange: () => void) => {
  addEventListener("popstate", onChange);
  addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    removeEventListener("popstate", onChange);
    removeEventListener(NAVIGATE_EVENT, onChange);
  };
};
const currentPath = () => appPath(location.pathname);

export function usePath(): string {
  return useSyncExternalStore(subscribe, currentPath, currentPath);
}

export function navigate(path: string, { replace = false } = {}): void {
  const [pathPart, hash] = path.split("#") as [string, string | undefined];
  const samePage = appPath(location.pathname) === (pathPart || appPath(location.pathname));
  const url = href(pathPart || appPath(location.pathname)) + (hash ? `#${hash}` : "");
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  dispatchEvent(new Event(NAVIGATE_EVENT));
  if (hash) {
    // Wait a frame so a newly rendered page has its headings.
    requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash))?.scrollIntoView());
  } else if (!samePage) {
    scrollTo({ top: 0 });
  }
}

/**
 * Click handler for a container of rendered HTML (Markdown pages): internal links
 * navigate without a reload.
 */
export function interceptLinkClicks(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
  event.preventDefault();
  navigate(appPath(url.pathname) + url.hash);
}

export function Link({ to, onClick, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string }) {
  return (
    <a
      {...props}
      href={to.startsWith("#") ? to : href(to.split("#")[0]!) + (to.includes("#") ? `#${to.split("#")[1]}` : "")}
      onClick={(event) => {
        onClick?.(event);
        interceptLinkClicks(event);
      }}
    />
  );
}
