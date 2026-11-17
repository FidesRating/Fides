export default function MethodSection() {
  return (
    <>
    <section className="box method" id="method" aria-labelledby="h-method">
      <div className="l">
        <span className="idx">METHODOLOGY</span>
        <span className="eyebrow"><i className="dot"></i>FAIR TO THE RATED, USEFUL TO THE READER</span>
        <h2 id="h-method">Every rating can be checked, <em>and answered.</em></h2>
        <p className="sub">Public data only, a published scorecard, notice before publication, and a right of reply on the page.</p>
        <div className="formula">
          <div className="fh">SCORECARD · 0–100</div>
          <div className="fx">
            total = <b>0.35</b> × Accuracy + <b>0.25</b> × Disclosure<br/>
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ <b>0.25</b> × Wallet Alignment + <b>0.15</b> × Conduct<br/>
            <span style={{ color: 'var(--ink-faint)' }}>rounded, then mapped to the scale</span>
          </div>
        </div>
        <table>
          <caption className="eyebrow" style={{ display: 'table-caption', textAlign: 'left', paddingBottom: '8px' }}>AUTOMATIC RULES · THE COMMITTEE CANNOT OVERRIDE</caption>
          <thead><tr><th scope="col">Rule</th><th scope="col">Trigger</th><th scope="col">Result</th></tr></thead>
          <tbody>
            <tr><td>Not Rated</td><td>Fewer than 20 calls old enough to measure (≥ 30 days)</td><td className="res">NR, no public score</td></tr>
            <tr><td>Default on trust</td><td>One call: proven paid promotion, undisclosed, and a verified wallet sold ≥ 50% of that token within 7 days</td><td className="res">D, whatever the score</td></tr>
            <tr><td>Rug cap</td><td>Promoted a proven rug in the last 12 months and never withdrew the call</td><td className="res">CCC+ at most</td></tr>
            <tr><td>Transparency cap</td><td>No verified wallet</td><td className="res">A at most</td></tr>
          </tbody>
        </table>
      </div>
      <div className="r">
        <div className="term">
          <div className="win-bar"><span>scorecard.sh</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
<pre><span className="p">$</span> fides score @lunar_alpha{"\n"}<span className="o">&gt; accuracy     56 × 0.35 = 19.60</span>{"\n"}<span className="o">&gt; disclosure   50 × 0.25 = 12.50</span>{"\n"}<span className="o">&gt; wallet       80 × 0.25 = 20.00</span>{"\n"}<span className="o">&gt; conduct      94 × 0.15 = 14.10</span>{"\n"}<span className="g">&gt; total        66.2 → 66 → BBB+</span>{"\n"}<span className="p">$</span> fides committee --votes BBB,BBB,BBB+{"\n"}<span className="o">&gt; median       BBB  (−1 notch, rationale published)</span>{"\n"}<span className="rd">&gt; outlook      Negative</span>{"\n"}<span className="p">$</span> fides notice @lunar_alpha{"\n"}<span className="o">&gt; 48h notice before publication</span>{"\n"}<span className="p">$</span> <span className="caret"></span></pre>
        </div>
        <div className="committee">
          <span className="eyebrow">RATING COMMITTEE</span>
          <h3>Who decides, and how</h3>
          <ol>
            <li>At least 3 members with no conflict of interest. A conflicted member recuses.</li>
            <li>Each member picks one rating and one outlook. The final rating is the median vote.</li>
            <li>The median stays within ±1 notch of the scorecard and never passes a cap. Any shift from the scorecard comes with a published reason.</li>
            <li>Full committee review at least every 6 months. Scorecards are recalculated monthly; a gap of one notch or more goes back to the committee.</li>
          </ol>
        </div>
      </div>
    </section>
    </>
  );
}
