import Link from 'next/link';
import type { RatingListItem } from '@/lib/api';
import { ACTION_LABEL, BAND_CLASS, BAND_LABEL, OUTLOOK, formatDate, watchLabel, formatRating } from '@/lib/format';

export default function RatingsTable({ items }: { items: RatingListItem[] }) {
  if (!items.length) {
    return (
      <div className="empty-state">
        <p>First ratings coming soon.</p>
        <Link className="btn primary" href="/claim">Claim your profile ↗</Link>
      </div>
    );
  }
  return (
    <div className="rl-wrap">
      <table className="rl-table">
        <thead>
          <tr>
            <th scope="col">Account</th><th scope="col">Rating</th><th scope="col">Outlook</th><th scope="col">Watch</th>
            <th scope="col">Score</th><th scope="col">Weakest pillar</th><th scope="col">Last action</th><th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => {
            const b = BAND_CLASS[r.band];
            const o = r.outlook ? OUTLOOK[r.outlook] : null;
            return (
              <tr key={r.handle}>
                <td className="rl-acc">
                  <Link href={`/ratings/${r.handle}`}>@{r.handle}</Link>
                  <small>{r.followers.toLocaleString('en-US')} followers · {r.participating ? 'Participating' : 'Unsolicited'}</small>
                </td>
                <td>
                  <div className="rl-rating">
                    <span className={`rb ${b}`}>{formatRating(r.rating)}</span>
                    <span className={`rl-band ${b}`}>{BAND_LABEL[r.band]}</span>
                  </div>
                </td>
                <td>{o ? <span className={`rl-out ${o.tone}`}><b aria-hidden="true">{o.arrow}</b>{o.label}</span> : <span className="rl-dash">—</span>}</td>
                <td>{r.watch ? <span className="rl-watch">{watchLabel(r.watch)}</span> : <span className="rl-dash">—</span>}</td>
                <td>{r.totalScore ?? '—'}</td>
                <td>{r.weakestPillar ?? '—'}</td>
                <td className="rl-act">{ACTION_LABEL[r.lastAction.type] ?? r.lastAction.type}</td>
                <td>{formatDate(r.lastAction.publishedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
