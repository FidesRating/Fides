import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { getActionCard } from '@/lib/api';
import { ACTION_LABEL, OUTLOOK, formatDate, formatRating } from '@/lib/format';

type Props = { params: Promise<{ actionId: string }> };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const summary = (c: { handle: string; type: string; rating: string | null; previousRating: string | null; outlook: string | null; publishedAt: string; actionId: string }) => {
  const outlook = c.outlook ? `, Outlook ${OUTLOOK[c.outlook]?.label ?? c.outlook}` : '';
  const move = c.previousRating ? `${formatRating(c.previousRating)} to ${formatRating(c.rating)}` : formatRating(c.rating);
  return `@${c.handle}: ${ACTION_LABEL[c.type] ?? c.type}, ${move}${outlook}. ${c.actionId}, ${formatDate(c.publishedAt)}.`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { actionId } = await params;
  const res = await getActionCard(actionId);
  if (res.state !== 'ok') return { title: 'Rating action', robots: { index: false } };
  return {
    title: `${res.data.actionId} · @${res.data.handle} | FIDES rating action`,
    description: `${summary(res.data)} A FIDES rating is an opinion, not advice.`,
    twitter: { card: 'summary_large_image' },
  };
}

export default async function ActionPage({ params }: Props) {
  const { actionId } = await params;
  const res = await getActionCard(actionId);
  if (res.state === 'notfound' || res.state === 'gone') notFound();
  if (res.state === 'error') {
    return <section className="box empty-state"><p>This rating action is temporarily unavailable. Please try again in a moment.</p></section>;
  }
  const c = res.data;
  const text = `${summary(c)} (FIDES: opinion, not advice)`;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${SITE}/actions/${c.actionId}`)}`;
  return (
    <div className="page-stack">
      <PageHeader
        crumb={c.actionId}
        chip={`${ACTION_LABEL[c.type] ?? c.type}`}
        title={<>@{c.handle} <em>{formatRating(c.rating)}</em></>}
        sub={summary(c)}
      />
      <section className="box" style={{ padding: 24, display: 'grid', gap: 16 }}>
        <p>FIDES ratings are opinions based on public data and a published methodology. They are not statements of fact, not regulated credit ratings, and not investment advice.</p>
        <div className="btns">
          <Link className="btn primary" href={`/ratings/${c.handle}`}>Open the rating report</Link>
          <a className="btn" href={share} target="_blank" rel="noopener noreferrer">Share on X</a>
        </div>
      </section>
    </div>
  );
}
