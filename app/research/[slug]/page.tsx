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

// A short single line without closing punctuation is shown as a section heading.
const isHeading = (p: string) => p.length <= 80 && !p.includes('\n') && !/[.:;!?,]$/.test(p) && !p.startsWith('-');

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const res = await getArticle(slug);
  if (res.state === 'notfound' || res.state === 'gone') notFound();
  if (res.state === 'error') {
    return <section className="box empty-state"><p>This article is temporarily unavailable. Please try again in a moment.</p></section>;
  }
  const a = res.data;
  const kind = a.kind.replace(/_/g, ' ');
  // The body is plain text: React escapes it, and blank lines split blocks.
  const blocks = a.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="page-stack">
      <div className="crumbs"><Link href="/research">Research</Link><span>/</span><span>{kind}</span></div>
      <div className="art-layout">
        <article className="box panel art-main">
          <span className="eyebrow">{kind.toUpperCase()}</span>
          <h1>{a.title}</h1>
          {a.standfirst && <p className="art-lead">{a.standfirst}</p>}
          <p className="art-meta">{formatDate(a.publishedAt)}{a.readMinutes ? ` · ${a.readMinutes} min read` : ''}</p>
          {blocks.map((p, i) => {
            if (isHeading(p)) return <h3 key={i} className="art-h">{p}</h3>;
            if (p.startsWith('-')) {
              return <ul key={i} className="art-list">{p.split('\n').map((l, j) => <li key={j}>{l.replace(/^-\s*/, '')}</li>)}</ul>;
            }
            return <p key={i} style={{ whiteSpace: 'pre-line' }}>{p}</p>;
          })}
        </article>
        <aside className="art-side">
          <div className="box panel">
            <span className="eyebrow">ABOUT THIS NOTE</span>
            <p>Published {formatDate(a.publishedAt)}.</p>
            <p>An opinion based on public data and the published methodology. Not investment advice. Token ownership never affects any rating.</p>
            <div className="btns">
              <Link className="btn" href="/methodology">Methodology ↗</Link>
              <Link className="btn" href="/ethics">Ethics ↗</Link>
            </div>
          </div>
          {a.influencers.length > 0 && (
            <div className="box panel">
              <span className="eyebrow">RELATED ACCOUNTS</span>
              <div className="btns">
                {a.influencers.map((i) => <Link key={i.handle} className="btn" href={`/ratings/${i.handle}`}>@{i.handle} ↗</Link>)}
              </div>
            </div>
          )}
          <Link className="btn" href="/research" style={{ alignSelf: 'flex-start' }}>← All research</Link>
        </aside>
      </div>
    </div>
  );
}
