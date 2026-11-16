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
import { getActions, getRatings, getStats } from '@/lib/api';

export default async function Home() {
  const [stats, actions, ratings] = await Promise.all([getStats(), getActions(12), getRatings()]);
  return (
    <div className="page-stack">
      <Hero stats={stats ?? { accountsRated: 0, callsTracked: 0, ratingActions: 0, aaaRatings: 0 }} />
      <ScaleSection />
      <ActionsSection actions={actions ?? []} />
      <RatingsPreview ratings={ratings ?? []} />
      <ReportSection />
      <BuiltSection />
      <MethodSection />
      <ResearchSection />
      <DeskSection />
      <WallSection />
      <CtaRow />
    </div>
  );
}
