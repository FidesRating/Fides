import Link from 'next/link';
import type { Report } from '@/lib/api';
import { OUTLOOK, formatRating } from '@/lib/format';
import { BAND_NAME, SCALE_ROWS } from '@/lib/scale';

/** One plain sentence about how the committee rating relates to the scorecard. */
function committeeSentence(report: Report): string {
  const { rating: r } = report;
  const s = r.scorecard;
  const idx = (x: string | null) => SCALE_ROWS.findIndex((row) => row.rating.replace('−', '-') === (x ?? '').replace('−', '-'));
  const gap = idx(r.rating) - idx(s.scorecardRating);
  if (idx(r.rating) < 0 || idx(s.scorecardRating) < 0 || gap === 0) return `The committee rating, ${formatRating(r.rating)}, matches the scorecard.`;
  return `The committee rating is ${formatRating(r.rating)}, ${Math.abs(gap)} notch${Math.abs(gap) > 1 ? 'es' : ''} ${gap > 0 ? 'below' : 'above'} the scorecard.`;
}

export default function ScalePage({ report }: { report: Report | null }) {
  return (
    <>
      <section className="box ph">
        <div className="l">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Scale</span></nav>
          <span className="eyebrow chip">THE SCALE · VERSION I</span>
          <h1>Trusted grade, <em>or speculative.</em></h1>
        </div>
        <div className="r">
          <p className="sub">Twenty-one letter grades, plus D and NR. The line that matters most runs between BBB− and BB+: above it is Trusted grade, below it Speculative grade.</p>
        </div>
        <span className="giant" aria-hidden="true">BBB</span>
      </section>
      <section className="box">
        <div className="secbar"><h3>Ratings and scorecard thresholds</h3><span className="eyebrow">SCORE 0–100</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th scope="col">Rating</th><th scope="col">Band</th><th scope="col">Scorecard</th><th scope="col">Meaning</th></tr></thead>
            <tbody>{SCALE_ROWS.map((r) => (<tr key={r.rating}><td>{r.rating}</td><td>{BAND_NAME[r.band]}</td><td>{r.score}</td><td className="wrap">{r.meaning}</td></tr>))}</tbody>
          </table>
        </div>
      </section>
      <div className="box ow" style={{ borderTop: 'var(--bw) solid var(--rule)' }}>
        <div className="win">
          <div className="win-bar" style={{ background: 'var(--ink-deep)', color: 'var(--paper)' }}><span>OUTLOOK · 6–24 MONTHS</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="kv">
            <div><span className="ar">↑</span>Positive</div><div>Rating likely to rise</div>
            <div><span className="ar">→</span>Stable</div><div>Rating likely to hold</div>
            <div><span className="ar">↓</span>Negative</div><div>Rating likely to fall</div>
            <div><span className="ar">↕</span>Developing</div><div>Direction unclear: one pillar improving, another worsening</div>
          </div>
          <div className="win-foot">An outlook shows a possible direction, not a promise of change. The system suggests it and the committee decides: Positive if the score rose ≥ 5 points since the last rating, Negative if it fell ≥ 5, Developing if one pillar rose ≥ 10 while another fell ≥ 10, otherwise Stable.</div>
        </div>
        <div className="win amber">
          <div className="win-bar"><span>RATING WATCH · RESOLVED IN 90 DAYS</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="kv">
            <div>Watch Positive</div><div>The event under review will likely raise the rating</div>
            <div>Watch Negative</div><div>The event under review will likely lower the rating</div>
            <div>Watch Evolving</div><div>Direction cannot be set yet</div>
          </div>
          <div className="win-foot">Opened on a specific event, such as new paid-promotion evidence or a suspected rug. Every watch has a public reason, and the result can move more than one notch.</div>
        </div>
      </div>
      <section className="box split">
        <div className="panel">
          <span className="eyebrow">UNSOLICITED</span>
          <h3>Every rating starts unsolicited.</h3>
          <p>FIDES rates accounts from public data without being asked, the way agencies rate issuers from public filings. The account is still notified 48 hours before publication.</p>
        </div>
        <div className="panel">
          <span className="eyebrow">PARTICIPATING</span>
          <h3>Claimed profiles are marked Participating.</h3>
          <p>An account that claims its profile can add signed wallets, reply on the rating page and appeal once per rating action. Participating does not raise a rating.</p>
          <Link className="btn" href="/claim" style={{ alignSelf: 'flex-start' }}>Claim your profile ↗</Link>
        </div>
      </section>
      {report && (
        <section className="box">
          <div className="secbar"><h3>Latest rating</h3><Link className="crumbs" href={`/ratings/${report.account.handle}`} style={{ color: 'var(--brass)' }}>Open the report for @{report.account.handle} →</Link></div>
          <div className="panel">
            <p>
              The latest published rating is for @{report.account.handle}. The scorecard gives {report.rating.scorecard.totalScore}, which maps to {formatRating(report.rating.scorecard.scorecardRating)}. {committeeSentence(report)}
              {report.rating.rationale ? ` Rationale: ${report.rating.rationale}` : ''}
              {report.rating.outlook && OUTLOOK[report.rating.outlook] ? ` Outlook ${OUTLOOK[report.rating.outlook].label}.` : ''}
            </p>
          </div>
        </section>
      )}
    </>
  );
}
