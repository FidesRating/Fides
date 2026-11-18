import { SCALE_ROWS } from '@/lib/scale';
import LadderCanvas from './LadderCanvas';

export default function ScaleSection() {
  return (
    <>
    <section className="box" id="rankings" aria-labelledby="h-scale">
      <div className="scale-top">
        <div className="copy">
          <span className="eyebrow"><i className="dot"></i>THE SCALE · VERSION I</span>
          <h2 id="h-scale">Trusted grade, <em>or speculative.</em></h2>
          <p className="sub">A rating is one letter, but it carries four pillars of evidence and a committee decision behind it.</p>
          <span className="giant" aria-hidden="true">AAA</span>
        </div>
        <div className="ladder-wrap" id="ladderWrap">
          <LadderCanvas />
          <div className="ladder-legend" aria-hidden="true">
            <span><i style={{ background: 'var(--trusted)' }}></i>TRUSTED · AAA–BBB−</span>
            <span><i style={{ background: 'var(--speculative)' }}></i>SPECULATIVE · BB+–C</span>
            <span><i style={{ background: 'var(--default)' }}></i>DEFAULT · D</span>
            <span><i style={{ background: '#b6b4b0' }}></i>NOT RATED · NR</span>
          </div>
        </div>
      </div>

      <div className="bands">
        <article className="band t">
          <span className="no">01</span>
          <h3>Trusted grade<small>AAA to BBB−</small></h3>
          <p>Calls that hold up, promotions disclosed, wallets that match the words.</p>
          <span className="lab">TRUSTED</span>
        </article>
        <article className="band s">
          <span className="no">02</span>
          <h3>Speculative grade<small>BB+ to C</small></h3>
          <p>Weak accuracy, missing disclosures, or selling into followers.</p>
          <span className="lab">SPECULATIVE</span>
        </article>
        <article className="band d">
          <span className="no">03</span>
          <h3>Default<small>D</small></h3>
          <p>An undisclosed paid promotion, sold from a declared wallet within a week of the call.</p>
          <span className="lab">DEFAULT ON TRUST</span>
        </article>
        <article className="band n">
          <span className="no">04</span>
          <h3>Not Rated<small>NR</small></h3>
          <p>Not enough measurable calls yet.</p>
          <span className="lab">INSUFFICIENT DATA</span>
        </article>
      </div>

      <div className="notches">
        <div className="notch-cap"><span>TRUSTED GRADE · SCORECARD MINIMUM</span><span className="c">BBB− / BB+ LINE</span><span>SPECULATIVE GRADE · DEFAULT · NOT RATED</span></div>
        <div className="notch-row">{SCALE_ROWS.map((n) => (<div key={n.rating} className={`nc ${n.band}${n.cut ? " cut" : ""}`}><b>{n.rating}</b><span>{n.score}</span></div>))}</div>
      </div>

      <div className="ow">
        <div className="win">
          <div className="win-bar" style={{ background: 'var(--ink-deep)', color: 'var(--paper)' }}><span>OUTLOOK.JSON · 6–24 MONTHS</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="kv">
            <div><span className="ar">↑</span>Positive</div><div>Rating likely to rise</div>
            <div><span className="ar">→</span>Stable</div><div>Rating likely to hold</div>
            <div><span className="ar">↓</span>Negative</div><div>Rating likely to fall</div>
            <div><span className="ar">↕</span>Developing</div><div>Direction unclear: one pillar improving, another worsening</div>
          </div>
          <div className="win-foot">An outlook shows a possible direction. It is not a promise of change.</div>
        </div>
        <div className="win amber">
          <div className="win-bar"><span>RATING_WATCH.JSON · RESOLVED IN 90 DAYS</span><span className="ctl" aria-hidden="true">▁ ▢ ✕</span></div>
          <div className="kv">
            <div>Watch Positive</div><div>The event under review will likely raise the rating</div>
            <div>Watch Negative</div><div>The event under review will likely lower the rating</div>
            <div>Watch Evolving</div><div>Direction cannot be set yet</div>
          </div>
          <div className="win-foot">Opened on a specific event, such as new paid-promotion evidence or a suspected rug. The result can move more than one notch.</div>
        </div>
      </div>
    </section>
    </>
  );
}
