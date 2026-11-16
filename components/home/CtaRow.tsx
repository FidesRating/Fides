import Link from 'next/link';

export default function CtaRow() {
  return (
    <>
    <div className="cta-row" id="claim">
      <section className="box cta" aria-labelledby="h-cta">
        <h2 id="h-cta">Check the rating before you follow the call.</h2>
        <p>Find the accounts whose calls hold up, and see why the others don't.</p>
        <Link className="btn" href="/ratings">See the Ratings <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg></Link>
        <span className="stripes" aria-hidden="true"></span>
      </section>
      <section className="box share win" aria-label="Share card preview">
        <div className="win-bar"><span>SHARE_CARD · 1200×675</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
        <div className="share-card-wrap">
          <div className="share-card">
            <div className="top-s"><span>FIDES · RATING ACTION</span><span>NEW</span></div>
            <div className="mid">
              <span className="r">BBB</span>
              <div className="d">@lunar_alpha<br/>Trusted grade<br/><b>Outlook Negative</b><br/>3 Nov 2026</div>
            </div>
            <div className="bot"><span>fides · opinion, not advice</span><span>sample</span></div>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
