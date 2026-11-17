import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getHistory } from '@/lib/api';
import { ACTION_CLASS, ACTION_LABEL, BAND_CLASS, OUTLOOK, formatDate, formatRating, watchLabel } from '@/lib/format';
import { bandOfRating } from '@/lib/scale';

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  return { title: `@${handle} | Rating history`, description: `Every FIDES rating action for @${handle}, newest first.` };
}

export default async function HistoryPage({ params }: Props) {
  const { handle } = await params;
  const res = await getHistory(handle);
  if (res.state === 'notfound' || res.state === 'gone') notFound();
  if (res.state === 'error') return <section className="box empty-state"><p>This history is temporarily unavailable.</p></section>;
  const rows = res.data;
  const current = rows.find((r) => r.current);

  const badge = (r: string | null) =>
    r ? <span className={`rb ${BAND_CLASS[bandOfRating(r)]}`} style={{ fontSize: 15, minWidth: 52 }}>{formatRating(r)}</span> : <span className="rl-dash">n/a</span>;

  return (
    <div className="page-stack">
      <section className="box ph">
        <div className="l">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link><span>/</span><Link href="/ratings">Ratings</Link><span>/</span><Link href={`/ratings/${handle}`}>@{handle}</Link><span>/</span><span>History</span>
          </nav>
          <span className="eyebrow chip">RATING HISTORY</span>
          <h1>@{handle}</h1>
        </div>
        <div className="r"><p className="sub">Every rating action for this account, newest first.{current ? <> Current rating: <b>{formatRating(current.rating)}</b>.</> : null}</p></div>
      </section>
      <section className="box">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th scope="col">Date</th><th scope="col">Action</th><th scope="col">From</th><th scope="col">To</th><th scope="col">Outlook</th><th scope="col">Watch</th></tr></thead>
            <tbody>
              {rows.map((h) => (
                <tr key={h.actionId}>
                  <td>{formatDate(h.publishedAt)}</td>
                  <td><span className={`rl-act ${ACTION_CLASS[h.type] === 'up' || ACTION_CLASS[h.type] === 'down' ? ACTION_CLASS[h.type] : ''}`}>{ACTION_LABEL[h.type] ?? h.type}</span></td>
                  <td>{badge(h.previousRating)}</td>
                  <td>{badge(h.rating)}</td>
                  <td className="mono">{h.outlook ? OUTLOOK[h.outlook]?.label ?? h.outlook : 'n/a'}</td>
                  <td>{h.watch ? <span className="rl-watch">{watchLabel(h.watch).toUpperCase()}</span> : <span className="rl-dash">n/a</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="preview-foot"><span className="note">Superseded ratings stay visible here.</span><Link className="btn primary" href={`/ratings/${handle}`}>Back to the report ↗</Link></div>
      </section>
    </div>
  );
}
