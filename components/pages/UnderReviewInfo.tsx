import Link from 'next/link';

export default function UnderReviewInfo() {
  return (
    <>
      <section className="box split">
        <div className="panel">
          <span className="eyebrow">WHAT EACH STAGE MEANS</span>
          <ul className="list-dot">
            <li><span><b>Scorecard.</b> An analyst checks the account qualifies, collects its calls, prices them at 7, 30 and 90 days and drafts the scorecard.</span></li>
            <li><span><b>Committee.</b> At least three members without a conflict of interest vote. The rating is the median vote.</span></li>
            <li><span><b>Notice period.</b> The account is told 48 hours before publication and can correct facts, reply or prepare an appeal.</span></li>
          </ul>
        </div>
        <div className="panel">
          <span className="eyebrow">ARE YOU ON THIS LIST?</span>
          <h3>Claim your profile to see the notice and reply.</h3>
          <p>Accounts that are not claimed are notified with a mention on X. Claimed accounts see the draft notice, can add signed wallets and can reply on the rating page.</p>
          <Link className="btn primary" href="/claim" style={{ alignSelf: 'flex-start' }}>Claim your profile ↗</Link>
        </div>
      </section>
    </>
  );
}
