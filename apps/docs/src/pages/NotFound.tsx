import { Link } from "../router";

export function NotFound() {
  return (
    <main className="not-found" id="main">
      <p className="eyebrow">404</p>
      <h1>This room has no exit.</h1>
      <p className="muted">There's nothing at this address. Try the docs, or start learning from the beginning.</p>
      <div className="hero-actions">
        <Link to="/" className="button">
          Home
        </Link>
        <Link to="/docs/introduction" className="button">
          Docs
        </Link>
        <Link to="/learn" className="button primary">
          Learn
        </Link>
      </div>
    </main>
  );
}
