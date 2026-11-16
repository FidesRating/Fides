import type { Metadata } from 'next';
import PageHeader from '@/components/PageHeader';
import UnderReviewInfo from '@/components/pages/UnderReviewInfo';
import { getUnderReview, type UnderReviewItem } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Under Review',
  description: 'Accounts being analysed, waiting for the committee, or in the 48-hour notice period.',
};

const STAGES: UnderReviewItem['stage'][] = ['Scorecard', 'Committee', 'Notice period'];

export default async function UnderReviewPage() {
  const items = (await getUnderReview()) ?? [];
  return (
    <div className="page-stack">
      <PageHeader
        crumb="Under Review"
        chip="UNDER REVIEW"
        title={<>Accounts <em>under review.</em></>}
        sub="Accounts being analysed, waiting for the committee, or in the 48-hour notice period. No rating is shown until it is published."
      />
      <section className="box">
        <div className="pipe">
          {STAGES.map((stage, i) => {
            const rows = items.filter((r) => r.stage === stage);
            return (
              <div key={stage}>
                <div className="ph2"><span>{stage.toUpperCase()}</span><b>{rows.length}</b></div>
                <div className="cards">
                  {rows.length ? rows.map((r) => (
                    <div className="rcard" key={r.handle}>
                      <span className="h">@{r.handle}</span>
                      <span className="m">In process since {formatDate(r.since)}</span>
                      <div className="prog" aria-hidden="true">
                        {STAGES.map((s, j) => <i key={s} className={j <= i ? 'on' : undefined} />)}
                      </div>
                    </div>
                  )) : <p className="nr">No accounts at this stage.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <UnderReviewInfo />
    </div>
  );
}
