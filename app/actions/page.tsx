import type { Metadata } from 'next';
import { ActionCard, EmptyActionCard } from '@/components/ActionsTrack';
import PageHeader from '@/components/PageHeader';
import { getActions } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Rating Actions',
  description: 'Every upgrade, downgrade, affirmation, new rating and watch, newest first.',
};

export default async function ActionsPage() {
  const actions = (await getActions(30)) ?? [];
  return (
    <div className="page-stack">
      <PageHeader
        crumb="Actions"
        chip="RATING ACTIONS"
        title={<>Rating <em>actions.</em></>}
        sub="Every upgrade, downgrade, affirmation, new rating and watch, newest first. Each card opens the Rating Report."
      />
      <section className="box">
        <div className="feed">
          {actions.length ? actions.map((a) => <ActionCard key={a.actionId} a={a} />) : <EmptyActionCard />}
        </div>
      </section>
    </div>
  );
}
