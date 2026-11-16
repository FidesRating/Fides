export default function BuiltSection() {
  return (
    <>
    <section className="box" aria-labelledby="h-built">
      <div className="sec-head built-head">
        <div className="l">
          <span className="idx">05 / HOW EVERY RATING IS BUILT</span>
          <h2 id="h-built">Three instruments. <em>One committee's vote.</em></h2>
        </div>
        <div className="l">
          <p className="sub">Data is gathered and scored with an AI stack, then voted on by a human Rating Committee before anything is published.</p>
          <span className="tag" style={{ whiteSpace: 'normal', alignSelf: 'flex-start', fontSize: '11.5px', padding: '6px 10px', borderColor: 'var(--brass)', color: 'var(--brass)' }}>VOTED BY A COMMITTEE — no rating is published by a model.</span>
        </div>
        <div className="seal" aria-hidden="true">
          <svg viewBox="0 0 128 128"><defs><path id="circ" d="M64 64m-50 0a50 50 0 1 1 100 0a50 50 0 1 1-100 0"/></defs><text fontFamily="IBM Plex Mono,monospace" fontSize="9.6" letterSpacing="2.4" fill="#7c1522"><textPath href="#circ">COMMITTEE RATED ✦ PUBLIC DATA ✦ RIGHT OF REPLY ✦</textPath></text></svg>
          <b>F</b>
        </div>
      </div>
      <div className="desks">
        <article className="desk win">
          <div className="win-bar" style={{ background: 'var(--ink-deep)', color: 'var(--paper)' }}><span>ANALYST_DESK</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="body">
            <span className="model">Claude Fable 5</span>
            <h3>Analyst Desk</h3>
            <p>Extracts calls from public posts, prices each one at 7, 30 and 90 days, and drafts the scorecard and report.</p>
            <div className="meter" aria-hidden="true"><i></i><i></i><i></i><i className="o"></i><i className="o"></i></div>
          </div>
        </article>
        <article className="desk win amber">
          <div className="win-bar"><span>VISUAL_DESK</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="body">
            <span className="model">Nano Banana</span>
            <h3>Visual Desk</h3>
            <p>Produces each report's visual record: call charts, pillar plates, and action cards for sharing.</p>
            <div className="meter" aria-hidden="true"><i></i><i></i><i className="o"></i><i className="o"></i><i className="o"></i></div>
          </div>
        </article>
        <article className="desk win red">
          <div className="win-bar"><span>SIGNAL_DESK</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="body">
            <span className="model">Grok</span>
            <h3>Signal Desk</h3>
            <p>Watches X for new calls, deleted posts, and paid-promotion evidence that may trigger a Rating Watch.</p>
            <div className="meter" aria-hidden="true"><i></i><i></i><i></i><i></i><i className="o"></i></div>
          </div>
        </article>
      </div>
      <div className="strip"><span>SCORED BY AI</span><span>VOTED BY PEOPLE</span><span>NOTIFIED BEFORE PUBLICATION</span></div>
    </section>
    </>
  );
}
