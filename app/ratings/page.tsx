import type { Metadata } from 'next';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import RatingsTable from '@/components/RatingsTable';
import { getFilteredRatings } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Ratings',
  description: 'Every rated crypto influencer account, AAA first.',
};

type Search = { band?: string; rating?: string; outlook?: string; watch?: string; sort?: string; coverage?: string };

const BANDS = [
  { value: '', label: 'All' },
  { value: 'trusted', label: 'Trusted' },
  { value: 'speculative', label: 'Speculative' },
  { value: 'default', label: 'Default' },
  { value: 'not_rated', label: 'NR' },
];
const RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', 'B+', 'B', 'B-', 'CCC+', 'CCC', 'CCC-', 'CC', 'C', 'D', 'NR'];
const OUTLOOKS = ['positive', 'stable', 'negative', 'developing'];

// Whitelist query values before they reach the API.
const pick = (v: string | undefined, allowed: string[]) => (v && allowed.includes(v) ? v : undefined);

export default async function RatingsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const f = {
    band: pick(sp.band, BANDS.map((b) => b.value)),
    rating: pick(sp.rating, RATINGS),
    outlook: pick(sp.outlook, OUTLOOKS),
    watch: pick(sp.watch, ['true']),
    sort: pick(sp.sort, ['rating', 'recent', 'followers']),
  };
  const coverage = pick(sp.coverage, ['participating', 'unsolicited']);
  let items = (await getFilteredRatings(f)) ?? [];
  if (coverage) items = items.filter((i) => i.participating === (coverage === 'participating'));
  const filtered = Boolean(f.band || f.rating || f.outlook || f.watch || coverage);

  return (
    <div className="page-stack">
      <PageHeader
        crumb="Ratings"
        chip="RATINGS · AAA TO D"
        title={<>Every rated account, <em>AAA first.</em></>}
        sub="Public accounts on X with at least 5,000 followers that post token calls. Rated on what they do in public, never on their private lives."
        giant="A–D"
      />
      <section className="box">
        <form className="rl-tools" method="get" aria-label="Filter ratings">
          <div className="rl-chips" role="group" aria-label="Band">
            {BANDS.map((b) => (
              <Link key={b.value || 'all'} href={{ pathname: '/ratings', query: { ...(b.value ? { band: b.value } : {}), ...(f.sort ? { sort: f.sort } : {}) } }} aria-pressed={(f.band ?? '') === b.value}>
                <button type="button" tabIndex={-1} aria-pressed={(f.band ?? '') === b.value}>{b.label}</button>
              </Link>
            ))}
          </div>
          <label className="rl-field">Rating
            <select name="rating" defaultValue={f.rating ?? ''}>
              <option value="">Any</option>
              {RATINGS.map((r) => <option key={r} value={r}>{r.replace('-', '−')}</option>)}
            </select>
          </label>
          <label className="rl-field">Outlook
            <select name="outlook" defaultValue={f.outlook ?? ''}>
              <option value="">Any</option>
              {OUTLOOKS.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
            </select>
          </label>
          <label className="rl-field">Coverage
            <select name="coverage" defaultValue={coverage ?? ''}>
              <option value="">All</option>
              <option value="unsolicited">Unsolicited</option>
              <option value="participating">Participating</option>
            </select>
          </label>
          <label className="rl-field">Sort
            <select name="sort" defaultValue={f.sort ?? 'rating'}>
              <option value="rating">Rating</option>
              <option value="recent">Latest change</option>
              <option value="followers">Followers</option>
            </select>
          </label>
          <label className="rl-check"><input type="checkbox" name="watch" value="true" defaultChecked={f.watch === 'true'} /> On Rating Watch</label>
          {f.band && <input type="hidden" name="band" value={f.band} />}
          <button className="btn" type="submit">Apply</button>
          {filtered && <Link className="note" href="/ratings">Clear filters</Link>}
          <span className="rl-count" aria-live="polite">{items.length} account{items.length === 1 ? '' : 's'}</span>
        </form>
        <RatingsTable items={items} />
      </section>
    </div>
  );
}
