import type { Metadata } from 'next';
import StaffConsole from '@/components/staff/StaffConsole';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'FIDES Staff',
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return (
    <div className="page-stack">
      <PageHeader
        crumb="Staff"
        chip="STAFF ONLY"
        title={<>Staff sign in.</>}
        sub="For analysts, committee members and admins. Access comes only from the owner-managed wallet list, never from holding the token."
      />
      <StaffConsole />
    </div>
  );
}
