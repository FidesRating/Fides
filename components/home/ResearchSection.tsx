import Link from 'next/link';

export default function ResearchSection() {
  return (
    <>
    <section className="box research" id="research" aria-labelledby="h-research">
      <div className="l">
        <span className="idx">07 / RESEARCH</span>
        <h2 id="h-research">The research behind <em>the ratings.</em></h2>
        <Link className="btn" href="/research" style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>All research <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg></Link>
      </div>
      <ul className="rlist">
        <li><Link href="/research"><span className="t">DOWNGRADE NOTE</span><span className="ti">Why a 300k-follower account moved from A to BB.</span><span className="go" aria-hidden="true">↗</span></Link></li>
        <li><Link href="/research"><span className="t">STUDY</span><span className="ti">1,200 calls, 90 days later: who beat Bitcoin.</span><span className="go" aria-hidden="true">↗</span></Link></li>
        <li><Link href="/research"><span className="t">METHODOLOGY NOTE</span><span className="ti">How we price a call that was deleted.</span><span className="go" aria-hidden="true">↗</span></Link></li>
        <li><Link href="/research"><span className="t">CASE FILE</span><span className="ti">Anatomy of a D rating.</span><span className="go" aria-hidden="true">↗</span></Link></li>
        <li><Link href="/research"><span className="t">INTERVIEW</span><span className="ti">An AAA account on how they disclose every deal.</span><span className="go" aria-hidden="true">↗</span></Link></li>
      </ul>
    </section>
    </>
  );
}
