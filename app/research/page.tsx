import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import { getResearch } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Research',
  description: 'Downgrade notes, studies, methodology notes, case files and interviews.',
};

export default async function ResearchPage() {
  const articles = (await getResearch()) ?? [];
  return (
    <div className="page-stack">
      <PageHeader
        crumb="Research"
        chip="RESEARCH"
        title={<>The research behind <em>the ratings.</em></>}
        sub="Downgrade notes, studies, methodology notes, case files and interviews."
      />
      <section className="box">
        {articles.length ? (
          <div className="rgrid">
            {articles.map((a) => (
              <article className="rart" key={a.slug}>
                <span className="t">{a.kind.replace(/_/g, ' ').toUpperCase()}</span>
                <h3>{a.title}</h3>
                {a.standfirst && <p>{a.standfirst}</p>}
                <span className="st">{formatDate(a.publishedAt)}{a.readMinutes ? ` · ${a.readMinutes} min read` : ''}</span>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>Research notes will appear here once the first ratings are published.</p></div>
        )}
      </section>
    </div>
  );
}
