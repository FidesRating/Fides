'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ctx, Section, Table, optVal, panel, row, stamp, val } from './shared';

const OUTLOOKS = ['positive', 'stable', 'negative', 'developing'];
const WATCHES = ['watch_positive', 'watch_negative', 'watch_evolving'];

interface QueueRow {
  id: string; actionId: string; status: string;
  influencer: { id: string; handle: string; displayName: string | null };
  scorecard: { accuracy: number | null; disclosure: number | null; walletAlignment: number | null; conduct: number | null; totalScore: number | null; scorecardRating: string | null; appliedCaps: string[]; isDefault: boolean; notRated: boolean };
  suggestedOutlook: string | null; allowedVotes: string[]; votesCast: number;
  myVote: { recused: boolean; rating: string | null; outlook: string | null; note: string | null } | null;
  conflicted: boolean; publishAfter: string | null; noticeChannel: string | null; hasNoticeProof: boolean; rationale: string | null; rating: string | null;
}
interface PublishedRow { id: string; actionId: string; rating: string | null; outlook: string | null; watch: string | null; watchReason: string | null; influencer: { handle: string } }
interface AppealRow { id: string; reason: string; status: string; createdAt: string; decision: string | null; action: { actionNumber: number; rating: string | null; influencer: { handle: string } } }

export function CommitteePanel({ ctx, onCount }: { ctx: Ctx; onCount: (n: number) => void }) {
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const load = useCallback(async () => {
    const r = await ctx.call('/committee/queue');
    if (r.ok) { setQueue(r.json); onCount(r.json.length); }
  }, [ctx, onCount]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const act = async (path: string, body: unknown, method: string, done: string) => {
    const r = await ctx.call(path, body, method, done);
    if (r.ok) await load();
    return r;
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="box" style={panel}>
        <Section title={`Waiting for the committee (${queue.length})`} hint="A vote must stay within one notch of the scorecard and never above a cap. At least 3 non-conflicted votes are needed to finalize. If your rating differs from the scorecard, a published rationale is required.">
          {queue.length === 0 && <p>Nothing is waiting.</p>}
          {queue.map((a) => (
            <div key={a.id} className="box" style={{ ...panel, background: 'var(--paper-3)' }}>
              <div style={{ ...row, justifyContent: 'space-between' }}>
                <div>
                  <span className="eyebrow chip">{a.status.toUpperCase()}</span>
                  <h3 style={{ marginTop: 8 }}>{a.actionId} · @{a.influencer.handle}</h3>
                </div>
                <p>Scorecard <b>{a.scorecard.scorecardRating ?? 'n/a'}</b> ({a.scorecard.totalScore ?? 'n/a'}) · {a.votesCast} votes cast</p>
              </div>
              <p>
                Accuracy {a.scorecard.accuracy ?? '-'} · Disclosure {a.scorecard.disclosure ?? '-'} · Wallet alignment {a.scorecard.walletAlignment ?? '-'} · Conduct {a.scorecard.conduct ?? '-'}
                {a.scorecard.appliedCaps.length ? ` · caps: ${a.scorecard.appliedCaps.join(', ')}` : ''}{a.suggestedOutlook ? ` · suggested outlook ${a.suggestedOutlook}` : ''}
              </p>

              {a.status === 'committee' && (
                <>
                  {a.conflicted ? <p>You declared a conflict for this account, so you are recused.</p> : (
                    <form
                      className="form"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                        const body = submitter?.value === 'recuse' ? { recuse: true } : { rating: val(f, 'rating'), outlook: val(f, 'outlook'), note: optVal(f, 'note') };
                        await act(`/committee/actions/${a.id}/vote`, body, 'PUT', submitter?.value === 'recuse' ? 'You recused yourself from this action.' : 'Vote saved. You can change it until the action is finalized.');
                      }}
                    >
                      <label>Your rating<select name="rating" defaultValue={a.myVote?.rating ?? a.scorecard.scorecardRating ?? ''}>{a.allowedVotes.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
                      <label>Outlook<select name="outlook" defaultValue={a.myVote?.outlook ?? a.suggestedOutlook ?? 'stable'}>{OUTLOOKS.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
                      <label className="full">Note (internal)<input name="note" maxLength={1000} defaultValue={a.myVote?.note ?? ''} /></label>
                      <div className="full" style={row}>
                        <button className="btn primary" value="vote" disabled={ctx.busy}>{a.myVote && !a.myVote.recused ? 'Change vote' : 'Cast vote'}</button>
                        <button className="btn" value="recuse" formNoValidate disabled={ctx.busy}>Recuse myself</button>
                        {a.myVote && <span>{a.myVote.recused ? 'You are recused.' : `Your vote: ${a.myVote.rating} (${a.myVote.outlook}).`}</span>}
                      </div>
                    </form>
                  )}

                  <form className="form" onSubmit={async (e) => { e.preventDefault(); await act(`/committee/actions/${a.id}/finalize`, { rationale: optVal(e.currentTarget, 'rationale') }, 'POST', 'Finalized. The notice period has started.'); }}>
                    <label className="full">Rationale (required if the final rating differs from the scorecard; it is published)<input name="rationale" maxLength={2000} /></label>
                    <div className="full"><button className="btn" disabled={ctx.busy || a.votesCast < 3}>{a.votesCast < 3 ? `Finalize (needs 3 votes, has ${a.votesCast})` : 'Finalize rating'}</button></div>
                  </form>
                </>
              )}

              {a.status === 'notice' && (
                <>
                  <p>Decided: <b>{a.rating}</b>{a.rationale ? ` · rationale: ${a.rationale}` : ''}. Notice channel: {a.noticeChannel === 'profile' ? 'claimed profile' : 'X mention'}. Publishable after {stamp(a.publishAfter)}.</p>
                  {a.noticeChannel === 'x_mention' && !a.hasNoticeProof && (
                    <form className="form" onSubmit={async (e) => { e.preventDefault(); await act(`/committee/actions/${a.id}/notice-proof`, { url: val(e.currentTarget, 'url') }, 'POST', 'Notice recorded. The notice period has started.'); }}>
                      <label className="full">URL of the public X mention (starts the notice clock)<input name="url" type="url" placeholder="https://x.com/.../status/..." required /></label>
                      <div className="full"><button className="btn" disabled={ctx.busy}>Record notice</button></div>
                    </form>
                  )}
                  <div><button className="btn primary" disabled={ctx.busy} onClick={() => act(`/committee/actions/${a.id}/publish`, {}, 'POST', 'Published.')}>Publish</button> <span>The server refuses before the notice period ends.</span></div>
                </>
              )}

              {!a.conflicted && (
                <form style={row} onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const r = await act('/committee/conflicts', { influencerId: a.influencer.id, reason: val(f, 'reason') }, 'POST', 'Conflict declared. You are recused from open actions on this account.'); if (r.ok) f.reset(); }}>
                  <input name="reason" placeholder="Declare a conflict with this account: reason" maxLength={300} required style={{ flex: '1 1 200px', minWidth: 0 }} />
                  <button className="btn" disabled={ctx.busy}>Declare conflict</button>
                </form>
              )}
            </div>
          ))}
        </Section>
      </div>

      <PublishedBox ctx={ctx} />
      <AppealsBox ctx={ctx} />
    </div>
  );
}

function PublishedBox({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<PublishedRow[]>([]);
  const load = useCallback(async () => {
    const r = await ctx.call('/committee/published');
    if (r.ok) setRows(r.json);
  }, [ctx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div className="box" style={panel}>
      <Section title="Published ratings and Rating Watch" hint="A watch needs a public reason and lasts at most 90 days.">
        {rows.length === 0 ? <p>No published ratings yet.</p> : (
          <Table head={['Action', 'Account', 'Rating', 'Outlook', 'Watch', 'Set or clear']}>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.actionId}</td><td>@{p.influencer.handle}</td><td>{p.rating}</td><td>{p.outlook ?? '-'}</td>
                <td>{p.watch ? p.watch.replace('watch_', '') : '-'}</td>
                <td>
                  <form style={row} onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const w = val(f, 'watch'); const r = await ctx.call(`/committee/actions/${p.id}/watch`, { watch: w || null, reason: optVal(f, 'reason') }, 'PATCH', w ? 'Rating Watch set.' : 'Rating Watch cleared.'); if (r.ok) load(); }}>
                    <select name="watch" defaultValue={p.watch ?? ''}><option value="">no watch</option>{WATCHES.map((w) => <option key={w} value={w}>{w.replace('watch_', '')}</option>)}</select>
                    <input name="reason" placeholder="Public reason" maxLength={500} defaultValue={p.watchReason ?? ''} style={{ width: 180 }} />
                    <button className="btn" disabled={ctx.busy}>Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}

function AppealsBox({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<AppealRow[]>([]);
  const load = useCallback(async () => {
    const r = await ctx.call('/committee/appeals');
    if (r.ok) setRows(r.json);
  }, [ctx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div className="box" style={panel}>
      <Section title={`Appeals (${rows.length})`} hint="One appeal per rating action, within 14 days. Reopening starts a new review that still needs the full quorum. Rejecting needs 3 non-conflicted members.">
        {rows.length === 0 ? <p>No appeals.</p> : (
          <Table head={['Action', 'Account', 'Rating', 'Reason', 'Status', 'Filed', 'Decide']}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>RA-{String(a.action.actionNumber).padStart(4, '0')}</td><td>@{a.action.influencer.handle}</td><td>{a.action.rating}</td>
                <td className="wrap">{a.reason}</td><td>{a.status}</td><td>{stamp(a.createdAt)}</td>
                <td>
                  {a.status === 'open' ? (
                    <form style={row} onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; const r = await ctx.call(`/committee/appeals/${a.id}/decide`, { decision: submitter?.value, note: val(f, 'note') }, 'POST', 'Appeal decision saved.'); if (r.ok) load(); }}>
                      <input name="note" placeholder="Decision note" maxLength={2000} required style={{ width: 160 }} />
                      <button className="btn" value="reopen" disabled={ctx.busy}>Reopen</button>
                      <button className="btn" value="reject" disabled={ctx.busy}>Reject</button>
                    </form>
                  ) : (a.decision ?? '-')}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
