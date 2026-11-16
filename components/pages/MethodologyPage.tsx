import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <>
      <section className="box ph">
        <div className="l">
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Methodology</span></nav>
          <span className="eyebrow chip">METHODOLOGY · VERSION I</span>
          <h1>Every rating can be checked, <em>and answered.</em></h1>
        </div>
        <div className="r">
          <p className="sub">Public data only, a published scorecard, notice before publication, and a right of reply on the page.</p>
          <p className="note">The scale is modelled on the letter scales used by credit rating agencies. FIDES is not affiliated with any of them. FIDES ratings are opinions, not regulated credit ratings and not investment advice.</p>
        </div>
      </section>
      <section className="box">
        <div className="secbar"><h3>Two steps</h3><span className="eyebrow">SCORECARD → COMMITTEE</span></div>
        <div className="split">
          <div className="panel">
            <span className="idx">STEP 1 · SCORECARD</span>
            <p>The scorecard turns four pillars into a score from 0 to 100 and maps it to the scale. It is calculated on the server from confirmed data only.</p>
          </div>
          <div className="panel">
            <span className="idx">STEP 2 · RATING COMMITTEE</span>
            <p>The committee sets the final rating. It may move at most one notch from the scorecard, with a written reason that is published. Caps, D and NR apply automatically and the committee cannot change them.</p>
          </div>
        </div>
      </section>
      <section className="box">
        <div className="secbar"><h3>Four pillars</h3><span className="eyebrow">WEIGHTS ADD UP TO 100%</span></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th scope="col">Pillar</th><th scope="col">Weight</th><th scope="col">Data</th><th scope="col">Score 0–100</th></tr></thead>
            <tbody>
              <tr><td>Call Accuracy</td><td className="res">35%</td><td className="wrap">Every call (a buy or sell recommendation for a token) at least 30 days old: price when posted vs price 30 days later, compared with BTC.</td><td className="wrap mono" style={{ fontSize: '12.5px' }}>100 × (0.6 × hit rate + 0.4 × clamp(median 30-day excess return + 0.5)). Hit rate = share of calls that beat BTC.</td></tr>
              <tr><td>Disclosure</td><td className="res">25%</td><td className="wrap">Proven paid promotions: public evidence, a project's own statement, or an on-chain payment to a wallet the account declared itself.</td><td className="wrap mono" style={{ fontSize: '12.5px' }}>100 × disclosed promotions ÷ all proven promotions. No proven promotion = 100.</td></tr>
              <tr><td>Wallet Alignment</td><td className="res">25%</td><td className="wrap">Only wallets the influencer declared in a public post or proved with a signature.</td><td className="wrap mono" style={{ fontSize: '12.5px' }}>100 × (1 − dump rate). Dump = the wallet sold ≥ 50% of a promoted token within 7 days of the call. No verified wallet = 50.</td></tr>
              <tr><td>Conduct</td><td className="res">15%</td><td className="wrap">Deleted calls (found through archives) and promoted projects later proven to be rugs.</td><td className="wrap mono" style={{ fontSize: '12.5px' }}>100 − 150 × share of calls deleted − 20 × rugs not withdrawn; minimum 0.</td></tr>
            </tbody>
          </table>
        </div>
        <div className="formula" style={{ borderLeft: '0', borderRight: '0', borderBottom: '0' }}>
          <div className="fh">TOTAL</div>
          <div className="fx">total = <b>0.35</b> × Accuracy + <b>0.25</b> × Disclosure + <b>0.25</b> × Wallet Alignment + <b>0.15</b> × Conduct <span style={{ color: 'var(--ink-faint)' }}>· rounded, then mapped to the <Link href="/scale" style={{ color: 'var(--brass)' }}>scale</Link></span></div>
        </div>
      </section>
      <section className="box split w64">
        <div>
          <div className="secbar"><h3>Automatic rules</h3><span className="eyebrow">THE COMMITTEE CANNOT OVERRIDE</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th scope="col">Rule</th><th scope="col">Trigger</th><th scope="col">Result</th></tr></thead>
              <tbody>
                <tr><td>Not Rated</td><td className="wrap">Fewer than 20 calls old enough to measure (≥ 30 days)</td><td className="res">NR, no public score</td></tr>
                <tr><td>Default on trust</td><td className="wrap">One call: proven paid promotion, undisclosed, and a verified wallet sold ≥ 50% of that token within 7 days</td><td className="res">D, whatever the score</td></tr>
                <tr><td>Rug cap</td><td className="wrap">Promoted a proven rug in the last 12 months and never withdrew the call</td><td className="res">CCC+ at most</td></tr>
                <tr><td>Transparency cap</td><td className="wrap">No verified wallet. The highest ratings need a wallet that can be checked.</td><td className="res">A at most</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="term" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="win-bar"><span>scorecard.sh · @lunar_alpha</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
<pre><span className="p">$</span> fides score @lunar_alpha{"\n"}<span className="o">&gt; accuracy     56 × 0.35 = 19.60</span>{"\n"}<span className="o">&gt; disclosure   50 × 0.25 = 12.50</span>{"\n"}<span className="o">&gt; wallet       80 × 0.25 = 20.00</span>{"\n"}<span className="o">&gt; conduct      94 × 0.15 = 14.10</span>{"\n"}<span className="g">&gt; total        66.2 → 66 → BBB+</span>{"\n"}<span className="p">$</span> fides committee --votes BBB,BBB,BBB+{"\n"}<span className="o">&gt; median       BBB  (−1 notch, reason published)</span>{"\n"}<span className="rd">&gt; outlook      Negative</span></pre>
        </div>
      </section>
      <section className="box split">
        <div className="panel committee" style={{ borderTop: '0' }}>
          <span className="eyebrow">RATING COMMITTEE</span>
          <h3>Who decides, and how</h3>
          <ol>
            <li>At least 3 members with no conflict of interest: never paid by the account, no shared investments, no personal relationship. A conflicted member recuses.</li>
            <li>Each member picks one rating and one outlook. The final rating is the median vote; the outlook is the most common vote.</li>
            <li>The median stays within ±1 notch of the scorecard and never passes a cap. Any shift from the scorecard comes with a published reason.</li>
            <li>A rating action cannot go to the committee while any promotion evidence is still pending.</li>
          </ol>
        </div>
        <div>
          <div className="secbar"><h3>Surveillance</h3><span className="eyebrow">AFTER PUBLICATION</span></div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th scope="col">Activity</th><th scope="col">Frequency</th></tr></thead>
              <tbody>
                <tr><td className="wrap">Add new calls and 7/30/90-day prices</td><td className="wrap">Daily, automatic</td></tr>
                <tr><td className="wrap">Recalculate the scorecard</td><td className="wrap">Monthly; a gap of ≥ 1 notch from the published rating goes to the committee</td></tr>
                <tr><td className="wrap">Full committee review</td><td className="wrap">At least every 6 months</td></tr>
                <tr><td className="wrap">Rating Watch</td><td className="wrap">On an event (new promotion evidence, a suspected rug), resolved within 90 days</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="box">
        <div className="secbar"><h3>The rating process</h3><span className="eyebrow">6 STAGES · NR AND APPEAL</span></div>
        <div className="steps">
          <div className="step"><span className="n">01</span><b>Coverage check</b><p>Public account, ≥ 10,000 followers, posts token calls regularly.</p><span className="who">ANALYST</span></div>
          <div className="step"><span className="n">02</span><b>Scorecard</b><p>Calls extracted and priced; promotions and wallets confirmed; scorecard drafted.</p><span className="who">ANALYST + AI STACK</span></div>
          <div className="step"><span className="n">03</span><b>Committee vote</b><p>Median of at least three votes, within ±1 notch and under any cap.</p><span className="who">RATING COMMITTEE</span></div>
          <div className="step"><span className="n">04</span><b>Notice</b><p>48 hours before publication. The account can correct facts and reply.</p><span className="who">ACCOUNT</span></div>
          <div className="step"><span className="n">05</span><b>Publication</b><p>Rating Report, evidence and any reply go live, with a share card.</p><span className="who">FIDES</span></div>
          <div className="step"><span className="n">06</span><b>Surveillance</b><p>New data flows back into the scorecard; review every 6 months.</p><span className="who">ANALYST</span></div>
        </div>
        <div className="branches">
          <div><b>NOT RATED</b>Fewer than 20 measurable calls at stage 2: the account gets NR and no public score.</div>
          <div><b>APPEAL</b>Claimed accounts only, once per rating action, within 14 days. Decided under the same committee rules.</div>
          <div><b>TAKEDOWN</b>Accounts that do not meet the coverage rules are removed from every public page. <Link href="/ethics" style={{ color: 'var(--brass)' }}>Ethics</Link></div>
        </div>
      </section>
    </>
  );
}
