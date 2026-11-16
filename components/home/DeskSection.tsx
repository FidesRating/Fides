import Link from 'next/link';

export default function DeskSection() {
  return (
    <>
    <section className="box holders" id="desk" aria-labelledby="h-desk">
      <div className="l">
        <span className="idx">08 / FOR HOLDERS</span>
        <span className="eyebrow"><i className="dot"></i>FOR THE FIDES DESK</span>
        <h2 id="h-desk">See the evidence first. <em>Never touch the rating.</em></h2>
        <Link className="btn" href="/desk" style={{ alignSelf: 'flex-start' }}>Open the FIDES Desk ↗</Link>
        <p className="sub">Holding the token opens the full data and early alerts. It does not, and cannot, change a rating.</p>
      </div>
      <div className="benefits">
        <div className="bf"><svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 4a8 8 0 0 0-8 8v6l-3 4h22l-3-4v-6a8 8 0 0 0-8-8zM13.5 26a3.5 3.5 0 0 0 7 0"/><circle cx="26" cy="7" r="3" fill="#7c1522" stroke="none"/></svg><div><b>Rating actions first</b><span>A notification the moment an action is published.</span></div></div>
        <div className="bf"><svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="5" width="26" height="24"/><path d="M4 11h26M4 17h26M4 23h26M12 5v24"/></svg><div><b>Full call history &amp; data</b><span>Every call, not only the latest 10.</span></div></div>
        <div className="bf"><svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 10 4 17l7 7M23 10l7 7-7 7M19 7l-4 20"/></svg><div><b>API access</b><span>Keys issued to holders.</span></div></div>
        <div className="bf"><svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17s5-9 14-9 14 9 14 9-5 9-14 9S3 17 3 17z"/><circle cx="17" cy="17" r="4"/></svg><div><b>Watchlist alerts</b><span>Follow the accounts you care about.</span></div></div>
        <div className="bf wide"><svg viewBox="0 0 34 34" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 5h16l6 6v18H6z"/><path d="M22 5v6h6M11 17h12M11 22h8"/></svg><div><b>Desk Tips</b><span>Send evidence to the analysts. Analysts never see who sent it.</span></div></div>
      </div>
    </section>
    </>
  );
}
