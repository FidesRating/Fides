import type { Metadata } from 'next';
import DeskFlow from '@/components/desk/DeskFlow';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'FIDES Desk',
  description: 'Holding the token opens the full data and the Desk. It never changes a rating.',
};

export default function DeskPage() {
  return (
    <div className="page-stack">
      <PageHeader
        crumb="FIDES Desk"
        chip="FOR THE FIDES DESK"
        title={<>See the evidence first. <em>Never touch the rating.</em></>}
        sub="Holding the token opens the full data and the Desk. It does not, and cannot, change a rating."
      />
      <DeskFlow />
    </div>
  );
}
