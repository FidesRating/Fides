export default function ReportSection() {
  return (
    <>
    <section className="box bp" aria-labelledby="h-rating">
      <div className="sec-head">
        <div className="l">
          <span className="idx">04 / THE REPORT</span>
          <span className="eyebrow">THE REPORT · THE RATING</span>
          <h2 id="h-rating">One letter. Four pillars. <em>One committee.</em></h2>
        </div>
        <div className="l">
          <p className="sub">Every rated account gets a Rating Report: a scorecard across four pillars, the evidence behind it, the committee's rationale, and the account's own reply. Desk Tips sit beside it, never inside it.</p>
          <div className="pill-row">
            <span className="pill">Call Accuracy <b>35%</b></span>
            <span className="pill">Disclosure <b>25%</b></span>
            <span className="pill">Wallet Alignment <b>25%</b></span>
            <span className="pill">Conduct <b>15%</b></span>
          </div>
        </div>
      </div>
      <div className="diagram" id="diagram">
        
        <div className="bcard pillar" data-w="56">
          <div className="k"><span>PILLAR 01</span><span>35%</span></div>
          <h4>Call Accuracy</h4>
          <p>60 measurable calls (of 70), hit rate 55%, median 30-day excess return +8% vs BTC.</p>
          <div className="bar"><i style={{ width: '56%' }}></i></div>
          <div className="bscore"><span>score</span><b>56</b></div>
        </div>
        <div className="bcard core in" id="core">
          <div className="k"><span>RATING REPORT · SAMPLE</span><span>NEW · 3 NOV 2026</span></div>
          <div className="top-r">
            <div>
              <div className="hd">@lunar_alpha</div>
              <div className="fol">182,000 followers · Unsolicited</div>
              <div className="fol">Next full review: May 2027</div>
            </div>
            <div>
              <div className="big" aria-label="Rating BBB">BBB</div>
              <div className="band-l">TRUSTED GRADE</div>
            </div>
          </div>
          <div className="flow">
            <div>SCORECARD<b>BBB+</b>66</div>
            <span className="arr">→</span>
            <div>COMMITTEE<b>BBB</b>−1 notch</div>
          </div>
          <div className="chips">
            <span className="tag neg">↓ Outlook Negative</span>
            <span className="tag">Votes: BBB · BBB · BBB+</span>
            <span className="tag">Reply: none yet</span>
          </div>
          <div className="sum">0.35×56 + 0.25×50 + 0.25×80 + 0.15×94 = 66.2</div>
        </div>
        <div className="bcard pillar" data-w="50">
          <div className="k"><span>PILLAR 02</span><span>25%</span></div>
          <h4>Disclosure</h4>
          <p>6 proven paid promotions, 3 disclosed.</p>
          <div className="bar"><i style={{ width: '50%' }}></i></div>
          <div className="bscore"><span>score</span><b>50</b></div>
        </div>
        <div className="bcard pillar" data-w="80">
          <div className="k"><span>PILLAR 03</span><span>25%</span></div>
          <h4>Wallet Alignment</h4>
          <p>2 verified wallets, 20 calls with the token held, 4 sales of ≥ 50% within 7 days.</p>
          <div className="bar"><i style={{ width: '80%' }}></i></div>
          <div className="bscore"><span>score</span><b>80</b></div>
        </div>
        <div className="bcard pillar" data-w="94">
          <div className="k"><span>PILLAR 04</span><span>15%</span></div>
          <h4>Conduct</h4>
          <p>70 calls, 3 deleted, 0 rugs.</p>
          <div className="bar"><i style={{ width: '94%' }}></i></div>
          <div className="bscore"><span>score</span><b>94</b></div>
        </div>
        <div className="quote">
          <div className="bcard">
            <div className="k"><span>COMMITTEE RATIONALE</span><span>3 MEMBERS</span></div>
            <blockquote style={{ marginTop: '10px' }}>“Three of six proven paid promotions were not disclosed, all within the last six months. The trend in disclosure weighs more than the strong conduct record.”</blockquote>
          </div>
          <div className="bcard tips">
            <div className="k"><span>DESK TIPS</span><span>BESIDE</span></div>
            <h4>Evidence, not votes</h4>
            <p>Tips go to the analyst queue. They are used only once proven, and never change a rating directly.</p>
          </div>
        </div>
      </div>
    </section>
    </>
  );
}
