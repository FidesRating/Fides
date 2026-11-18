import Link from 'next/link';

export default function NotFound() {
  return (
    <section className="box empty-state">
      <title>Page not found | FIDES</title>
      <h1>Page not found</h1>
      <p>The page or account you asked for does not exist, or was removed after a takedown.</p>
      <div className="btns" style={{ justifyContent: 'center' }}>
        <Link className="btn primary" href="/ratings">See the Ratings ↗</Link>
        <Link className="btn" href="/">Home</Link>
      </div>
    </section>
  );
}
