import type { Metadata } from 'next';
import Link from 'next/link';

// Served with status 410 by middleware.ts for taken-down accounts.
export const metadata: Metadata = { title: 'No longer covered', robots: { index: false, follow: false } };

export default function GonePage() {
  return (
    <section className="box empty-state">
      <h1>No longer covered</h1>
      <p>This account is no longer covered by FIDES and its rating page has been removed.</p>
      <div className="btns" style={{ justifyContent: 'center' }}>
        <Link className="btn primary" href="/ratings">See the Ratings ↗</Link>
        <Link className="btn" href="/ethics">Ethics</Link>
      </div>
    </section>
  );
}
