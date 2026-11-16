import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';

export const metadata: Metadata = {
  title: 'Claim your profile',
  description: 'Rated accounts can claim their profile to see notices, reply and appeal.',
};

export default function ClaimPage() {
  return (
    <div className="page-stack">
      <PageHeader
        crumb="Claim your profile"
        chip="CLAIM YOUR PROFILE"
        title={<>Answer your <em>rating.</em></>}
        sub="Claimed accounts see the notice before publication, add wallets with a signature, reply on the rating page and appeal once per rating action."
      />
      <section className="box empty-state">
        <p>Profile claims open soon.</p>
      </section>
    </div>
  );
}
