import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReportView from '@/components/report/ReportView';
import { getReport } from '@/lib/api';
import { OUTLOOK, formatDate, formatRating } from '@/lib/format';

type Props = { params: Promise<{ handle: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const res = await getReport(handle);
  if (res.state !== 'ok') return { title: 'Rating report', robots: { index: false } };
  const { rating } = res.data;
  const outlook = rating.outlook ? `, Outlook ${OUTLOOK[rating.outlook]?.label ?? rating.outlook}` : '';
  const summary = rating.rationale ?? `FIDES rating ${formatRating(rating.rating)} based on public data and a published methodology.`;
  return {
    title: { absolute: `@${res.data.account.handle} — FIDES rating ${formatRating(rating.rating)}${outlook}` },
    description: `${summary.split(/(?<=[.!?])\s/)[0]} Updated ${formatDate(rating.publishedAt)}.`,
  };
}

export default async function ReportPage({ params }: Props) {
  const { handle } = await params;
  const res = await getReport(handle);
  if (res.state === 'notfound' || res.state === 'gone') notFound();
  if (res.state === 'error') {
    return <section className="box empty-state"><p>This report is temporarily unavailable. Please try again in a moment.</p></section>;
  }
  const { rating, account } = res.data;
  // Article only: structured data for Review or Rating on a person can be misrepresented in search results.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `@${account.handle} — FIDES rating ${formatRating(rating.rating)}`,
    datePublished: rating.publishedAt,
    publisher: { '@type': 'Organization', name: 'FIDES' },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ReportView r={res.data} />
    </>
  );
}
