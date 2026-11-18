import type { Report } from '@/lib/api';
import { BAND_LABEL, OUTLOOK, formatDate, formatRating } from '@/lib/format';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const signedPct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n * 100))}%`;

/** The words under each pillar, built only from public report data. */
function pillarNotes(r: Report) {
  const s = r.rating.scorecard;
  const accuracy = [
    `${s.measurableCalls} measurable calls`,
    s.hitRate !== null ? `hit rate ${pct(s.hitRate)}` : null,
    s.medianExcess30d !== null ? `median 30-day excess ${signedPct(s.medianExcess30d)} vs BTC` : null,
  ].filter(Boolean).join(', ') + '.';
  const proven = r.evidence.paidPromotions;
  const disclosed = proven.filter((p) => p.disclosed).length;
  const wallets = r.evidence.wallets.length;
  return {
    accuracy,
    disclosure: proven.length ? `${proven.length} proven paid promotion${proven.length === 1 ? '' : 's'}, ${disclosed} disclosed.` : 'No proven paid promotions.',
    walletAlignment: wallets ? `${wallets} verified wallet${wallets === 1 ? '' : 's'}.` : 'No verified wallet yet, so the score is 50 by rule.',
    conduct: `${r.calls.total} calls recorded.`,
  };
}

function Head() {
  return (
    <div className="sec-head">
      <div className="l">
        <span className="idx">THE REPORT</span>
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
  );
}

function Pillar({ n, weight, title, note, score }: { n: string; weight: string; title: string; note: string; score: number }) {
  return (
    <div className="bcard pillar" data-w={score}>
      <div className="k"><span>PILLAR {n}</span><span>{weight}</span></div>
      <h4>{title}</h4>
      <p>{note}</p>
      <div className="bar"><i style={{ width: `${score}%` }}></i></div>
      <div className="bscore"><span>score</span><b>{score}</b></div>
    </div>
  );
}

function DeskTipsCard() {
  return (
    <div className="bcard tips">
      <div className="k"><span>DESK TIPS</span><span>BESIDE</span></div>
      <h4>Evidence, not votes</h4>
      <p>Tips go to the analyst queue. They are used only once proven, and never change a rating directly.</p>
    </div>
  );
}

/** The latest published rating, shown with its real data. Votes and staff are never part of the public report. */
function LiveReport({ report }: { report: Report }) {
  const r = report.rating;
  const s = r.scorecard;
  const pillars = s.pillars ?? [];
  const byKey = (key: string) => pillars.find((p) => p.key === key);
  const notes = pillarNotes(report);
  const outlook = r.outlook ? OUTLOOK[r.outlook] : null;
  const total = s.totalScore ?? 0;
  const sum = pillars.map((p) => `${p.weight.toFixed(2)}×${p.score}`).join(' + ');
  const review = new Date(report.nextFullReview).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const typeLabel = r.type === 'new' ? 'NEW' : r.type.toUpperCase();
  return (
    <div className="diagram" id="diagram">
      <Pillar n="01" weight="35%" title="Call Accuracy" note={notes.accuracy} score={byKey('accuracy')?.score ?? 0} />
      <div className="bcard core in" id="core">
        <div className="k"><span>RATING REPORT</span><span>{typeLabel} · {formatDate(r.publishedAt).toUpperCase()}</span></div>
        <div className="top-r">
          <div>
            <div className="hd">@{report.account.handle}</div>
            <div className="fol">{report.account.followers.toLocaleString('en-US')} followers · {report.account.coverage}</div>
            <div className="fol">Next full review: {review}</div>
          </div>
          <div>
            <div className="big" aria-label={`Rating ${formatRating(r.rating)}`}>{formatRating(r.rating)}</div>
            <div className="band-l">{r.band ? BAND_LABEL[r.band].toUpperCase() : ''}</div>
          </div>
        </div>
        <div className="flow">
          <div>SCORECARD<b>{formatRating(s.scorecardRating)}</b>{total}</div>
          <span className="arr">→</span>
          <div>COMMITTEE<b>{formatRating(r.rating)}</b>{s.differsFromScorecard ? 'differs from scorecard' : 'same as scorecard'}</div>
        </div>
        <div className="chips">
          {outlook && <span className={`tag${outlook.tone === 'neg' ? ' neg' : ''}`}>{outlook.arrow} Outlook {outlook.label}</span>}
          <span className="tag">{r.reply ? 'Reply published' : 'Reply: none yet'}</span>
        </div>
        <div className="sum">{sum} = {total}</div>
      </div>
      <Pillar n="02" weight="25%" title="Disclosure" note={notes.disclosure} score={byKey('disclosure')?.score ?? 0} />
      <Pillar n="03" weight="25%" title="Wallet Alignment" note={notes.walletAlignment} score={byKey('walletAlignment')?.score ?? 0} />
      <Pillar n="04" weight="15%" title="Conduct" note={notes.conduct} score={byKey('conduct')?.score ?? 0} />
      <div className="quote">
        <div className="bcard">
          <div className="k"><span>COMMITTEE RATIONALE</span><span>PUBLISHED</span></div>
          <blockquote style={{ marginTop: '10px' }}>
            {r.rationale ? `“${r.rationale}”` : 'The committee rating matches the scorecard, so no separate rationale is published.'}
          </blockquote>
        </div>
        <DeskTipsCard />
      </div>
    </div>
  );
}

/** Shown only while no rating has been published yet. It is marked as a sample. */
function SampleReport() {
  return (
    <div className="diagram" id="diagram">
      <Pillar n="01" weight="35%" title="Call Accuracy" note="60 measurable calls (of 70), hit rate 55%, median 30-day excess return +8% vs BTC." score={56} />
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
      <Pillar n="02" weight="25%" title="Disclosure" note="6 proven paid promotions, 3 disclosed." score={50} />
      <Pillar n="03" weight="25%" title="Wallet Alignment" note="2 verified wallets, 20 calls with the token held, 4 sales of ≥ 50% within 7 days." score={80} />
      <Pillar n="04" weight="15%" title="Conduct" note="70 calls, 3 deleted, 0 rugs." score={94} />
      <div className="quote">
        <div className="bcard">
          <div className="k"><span>COMMITTEE RATIONALE</span><span>3 MEMBERS</span></div>
          <blockquote style={{ marginTop: '10px' }}>“Three of six proven paid promotions were not disclosed, all within the last six months. The trend in disclosure weighs more than the strong conduct record.”</blockquote>
        </div>
        <DeskTipsCard />
      </div>
    </div>
  );
}

export default function ReportSection({ report }: { report: Report | null }) {
  return (
    <section className="box bp" aria-labelledby="h-rating">
      <Head />
      {report && report.rating.scorecard.pillars ? <LiveReport report={report} /> : <SampleReport />}
    </section>
  );
}
