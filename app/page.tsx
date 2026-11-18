import ActionsSection from '@/components/home/ActionsSection';
import BuiltSection from '@/components/home/BuiltSection';
import CtaRow from '@/components/home/CtaRow';
import DeskSection from '@/components/home/DeskSection';
import Hero from '@/components/home/Hero';
import MethodSection from '@/components/home/MethodSection';
import RatingsPreview from '@/components/home/RatingsPreview';
import ReportSection from '@/components/home/ReportSection';
import ResearchSection from '@/components/home/ResearchSection';
import ScaleSection from '@/components/home/ScaleSection';
import WallSection from '@/components/home/WallSection';
import { getActions, getRatings, getReport, getStats } from '@/lib/api';

export default async function Home() {
  const [stats, actions, ratings] = await Promise.all([getStats(), getActions(12), getRatings()]);
  // The report card shows the most recently published rating. Without one, the card falls back to a labelled sample.
  const latest = [...(ratings ?? [])].sort((a, b) => b.lastAction.publishedAt.localeCompare(a.lastAction.publishedAt))[0];
  const featured = latest ? await getReport(latest.handle) : null;
  return (
    <div className="page-stack">
      <Hero stats={stats ?? { accountsRated: 0, callsTracked: 0, ratingActions: 0, aaaRatings: 0 }} />
      <ScaleSection />
      <ActionsSection actions={actions ?? []} />
      <RatingsPreview ratings={ratings ?? []} />
      <ReportSection report={featured?.state === 'ok' ? featured.data : null} />
      <BuiltSection />
      <MethodSection />
      <ResearchSection />
      <DeskSection />
      <WallSection />
      <CtaRow action={actions?.[0] ?? null} band={ratings?.find((r) => r.handle === actions?.[0]?.handle)?.band ?? null} />
    </div>
  );
}
