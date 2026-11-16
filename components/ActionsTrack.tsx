import Link from 'next/link';
import type { RatingAction } from '@/lib/api';
import { ACTION_CLASS, ACTION_LABEL, OUTLOOK, formatDate, formatRating } from '@/lib/format';

export function ActionCard({ a }: { a: RatingAction }) {
  const outlook = a.outlook ? OUTLOOK[a.outlook] : null;
  return (
    <Link className={`ac ${ACTION_CLASS[a.type] ?? 'aff'}`} href={`/ratings/${a.handle}`}>
      <span className="type">{ACTION_LABEL[a.type] ?? a.type.toUpperCase()}</span>
      <span className="h">@{a.handle}</span>
      <span className="move">
        {a.previousRating && <span className="from">{formatRating(a.previousRating)} →</span>}
        <span className="to">{formatRating(a.rating)}</span>
      </span>
      <span className="foot">
        <span>{outlook ? `${outlook.arrow} ${outlook.label}` : '—'}</span>
        <span>{formatDate(a.publishedAt)}</span>
      </span>
    </Link>
  );
}

export function EmptyActionCard() {
  return (
    <div className="ac empty">
      <p>First ratings coming soon.</p>
      <Link className="btn primary" href="/claim">Claim your profile ↗</Link>
    </div>
  );
}

export default function ActionsTrack({ actions }: { actions: RatingAction[] }) {
  return (
    <div className="track" id="actionsTrack">
      {actions.length ? actions.map((a) => <ActionCard key={a.actionId} a={a} />) : <EmptyActionCard />}
    </div>
  );
}
