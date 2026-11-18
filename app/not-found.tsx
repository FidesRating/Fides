import type { Metadata } from 'next';
import Link from 'next/link';

// No canonical or og:url on a 404: the layout default would resolve to /_not-found.
export const metadata: Metadata = { title: { absolute: 'Page not found | FIDES' }, robots: { index: false }, alternates: { canonical: null }, openGraph: { title: 'Page not found | FIDES' } };

export default function NotFound() {
  return (
    <section className="box empty-state">
      <h1>Page not found</h1>
      <p>The page or account you asked for does not exist, or was removed after a takedown.</p>
      <div className="btns" style={{ justifyContent: 'center' }}>
        <Link className="btn primary" href="/ratings">See the Ratings ↗</Link>
        <Link className="btn" href="/">Home</Link>
      </div>
    </section>
  );
}
