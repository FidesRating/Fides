export default function WallSection() {
  return (
    <>
    <section className="box" aria-labelledby="h-wall">
      <div className="wall">
        <div className="l">
          <h2 id="h-wall">Tips and ratings are <em>kept apart.</em></h2>
          <p className="sub">Holders can send evidence. Analysts check it. Only the committee changes a rating.</p>
        </div>
        <div className="wall-flow">
          <div className="wf"><span className="k">01 · HOLDER</span><b>Sends evidence</b></div>
          <span className="wf-ar">→</span>
          <div className="wf"><span className="k">02 · ANALYST</span><b>Checks it</b></div>
          <div className="brick" role="img" aria-label="Wall between tips and ratings"></div>
          <div className="wf c"><span className="k">03 · COMMITTEE</span><b>Changes a rating</b></div>
        </div>
      </div>
      <div className="strip light"><span>TIPS ARE EVIDENCE, NOT VOTES</span><span>EVERY ACCOUNT CAN REPLY</span><span>THE TOKEN GRANTS ACCESS, NEVER RATINGS</span></div>
    </section>
    </>
  );
}
