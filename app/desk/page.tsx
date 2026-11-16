import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'FIDES Desk',
  description: 'Holding the token opens the full data and early alerts. It never changes a rating.',
};

export default function DeskPage() {
  return (
    <div className="page-stack">
      <PageHeader
        crumb="FIDES Desk"
        chip="FOR THE FIDES DESK"
        title={<>See the evidence first. <em>Never touch the rating.</em></>}
        sub="Holding the token opens the full data and early alerts. It does not, and cannot, change a rating."
      />
      <section className="box empty-state">
        <p>The FIDES Desk opens soon.</p>
      </section>
    </div>
  );
}
