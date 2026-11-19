import type { Report } from '@/lib/api';
import { OUTLOOK, formatDate, formatRating } from '@/lib/format';
import { SCALE_ROWS } from '@/lib/scale';

const PILLAR_LABEL: Record<string, string> = { accuracy: 'accuracy', disclosure: 'disclosure', walletAlignment: 'wallet', conduct: 'conduct' };
const idx = (r: string | null) => SCALE_ROWS.findIndex((x) => x.rating.replace('−', '-') === (r ?? '').replace('−', '-'));

/** Terminal view of the latest published rating. Individual committee votes are private, so only the final result is shown. */
export default function ScorecardTerminal({ report }: { report: Report | null }) {
  const s = report?.rating.scorecard;
  if (!report || !s?.pillars) {
    return <pre><span className="p">$</span> fides score{'\n'}<span className="o">&gt; no published rating yet</span>{'\n'}<span className="p">$</span> <span className="caret"></span></pre>;
  }
  const r = report.rating;
  const handle = report.account.handle;
  const outlook = r.outlook ? OUTLOOK[r.outlook] : null;
  const gap = idx(s.scorecardRating) >= 0 && idx(r.rating) >= 0 ? idx(r.rating) - idx(s.scorecardRating) : 0;
  const move = gap === 0 ? 'same as scorecard' : `${gap > 0 ? '−' : '+'}${Math.abs(gap)} notch from scorecard${r.rationale ? ', rationale published' : ''}`;
  return (
    <pre>
      <span className="p">$</span> fides score @{handle}{'\n'}
      {s.pillars.map((p) => (
        <span key={p.key}><span className="o">&gt; {(PILLAR_LABEL[p.key] ?? p.key).padEnd(12)}{p.score} × {p.weight.toFixed(2)} = {(p.score * p.weight).toFixed(2)}</span>{'\n'}</span>
      ))}
      <span className="g">&gt; total        {s.totalScore} → {formatRating(s.scorecardRating)}</span>{'\n'}
      <span className="p">$</span> fides committee @{handle}{'\n'}
      <span className="o">&gt; final        {formatRating(r.rating)}  ({move})</span>{'\n'}
      {outlook && <span className="rd">&gt; outlook      {outlook.label}{'\n'}</span>}
      <span className="p">$</span> fides published @{handle}{'\n'}
      <span className="o">&gt; {formatDate(r.publishedAt)} · 48h notice before publication</span>{'\n'}
      <span className="p">$</span> <span className="caret"></span>
    </pre>
  );
}
