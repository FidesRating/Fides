import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import { getResearch } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Research',
  description: 'Downgrade notes, studies, methodology notes, case files and interviews.',
};

const KINDS = [
  { value: '', label: 'All' },
  { value: 'downgrade_note', label: 'Downgrade notes' },
  { value: 'study', label: 'Studies' },
  { value: 'methodology_note', label: 'Methodology notes' },
  { value: 'case_file', label: 'Case files' },
  { value: 'interview', label: 'Interviews' },
];

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const sp = await searchParams;
  // Whitelist the query value before it reaches the API.
  const kind = KINDS.some((k) => k.value && k.value === sp.kind) ? sp.kind : undefined;
  const articles = (await getResearch(kind)) ?? [];
  const label = KINDS.find((k) => k.value === (kind ?? ''))?.label.toLowerCase();
  return (
    <div className="page-stack">
      <PageHeader
        crumb="Research"
        chip="RESEARCH"
        title={<>The research behind <em>the ratings.</em></>}
        sub="Downgrade notes, studies, methodology notes, case files and interviews."
      />
      <section className="box">
        <div className="rl-tools">
          <div className="rl-chips" role="group" aria-label="Type">
            {KINDS.map((k) => (
              <Link key={k.value || 'all'} href={k.value ? { pathname: '/research', query: { kind: k.value } } : '/research'} aria-pressed={(kind ?? '') === k.value}>
                <button type="button" tabIndex={-1} aria-pressed={(kind ?? '') === k.value}>{k.label}</button>
              </Link>
            ))}
          </div>
        </div>
        {articles.length ? (
          <div className="rgrid">
            {articles.map((a) => (
              <Link href={`/research/${a.slug}`} className="rart" key={a.slug}>
                <span className="t">{a.kind.replace(/_/g, ' ').toUpperCase()}</span>
                <h3>{a.title}</h3>
                {a.standfirst && <p>{a.standfirst}</p>}
                <span className="st">{formatDate(a.publishedAt)}{a.readMinutes ? ` · ${a.readMinutes} min read` : ''}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>{kind ? `No ${label} have been published yet.` : 'Research notes will appear here once the first ratings are published.'}</p>
            {kind && <Link className="note" href="/research">Show all research</Link>}
          </div>
        )}
      </section>
    </div>
  );
}
