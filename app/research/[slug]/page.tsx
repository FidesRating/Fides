import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getArticle } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await getArticle(slug);
  if (res.state !== 'ok') return { title: 'Research', robots: { index: false } };
  return { title: res.data.title, description: res.data.standfirst ?? undefined };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const res = await getArticle(slug);
  if (res.state === 'notfound' || res.state === 'gone') notFound();
  if (res.state === 'error') {
    return <section className="box empty-state"><p>This article is temporarily unavailable. Please try again in a moment.</p></section>;
  }
  const a = res.data;
  // The body is plain text: React escapes it, and blank lines split paragraphs.
  const paragraphs = a.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="page-stack">
      <div className="crumbs"><Link href="/research">Research</Link><span>/</span><span>{a.kind.replace(/_/g, ' ')}</span></div>
      <article className="box panel">
        <span className="eyebrow">{a.kind.replace(/_/g, ' ').toUpperCase()}</span>
        <h1>{a.title}</h1>
        {a.standfirst && <p><b>{a.standfirst}</b></p>}
        <p style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-faint)' }}>
          {formatDate(a.publishedAt)}{a.readMinutes ? ` · ${a.readMinutes} min read` : ''}
        </p>
        {paragraphs.map((p, i) => <p key={i} style={{ whiteSpace: 'pre-line' }}>{p}</p>)}
        {a.influencers.length > 0 && (
          <div className="btns">
            {a.influencers.map((i) => <Link key={i.handle} className="btn" href={`/ratings/${i.handle}`}>@{i.handle} ↗</Link>)}
          </div>
        )}
      </article>
      <section className="box panel">
        <span className="eyebrow">NOTE</span>
        <p>This article is an opinion based on public data and the published methodology. It is not investment advice, and token ownership never affects any rating.</p>
        <div className="btns"><Link className="btn" href="/methodology">Methodology ↗</Link><Link className="btn" href="/ethics">Ethics ↗</Link></div>
      </section>
    </div>
  );
}
