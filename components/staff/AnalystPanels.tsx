'use client';

import { useCallback, useEffect, useState } from 'react';
import InfluencerDetail from './InfluencerDetail';
import { Ctx, Hint, MIN_FOLLOWERS, followerHint, Section, Table, optVal, panel, row, shorten, stamp, val } from './shared';

interface InfluencerRow {
  id: string; handle: string; displayName: string | null; status: string;
  accounts: { id: string; followers: number | null }[];
  _count: { calls: number; wallets: number; promotions: number };
}

export function InfluencersPanel({ ctx, isAdmin, onCount }: { ctx: Ctx; isAdmin: boolean; onCount: (n: number) => void }) {
  const [rows, setRows] = useState<InfluencerRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await ctx.call('/admin/influencers');
    if (r.ok) { setRows(r.json); onCount(r.json.length); }
  }, [ctx, onCount]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {open && <InfluencerDetail ctx={ctx} id={open} isAdmin={isAdmin} onChanged={load} onClose={() => setOpen(null)} />}

      <div className="box" style={panel}>
        <Section title="Add influencer" hint="Public X account only. The server rejects accounts below the follower minimum and handles already tracked.">
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const r = await ctx.call('/admin/influencers', { handle: val(f, 'handle'), displayName: val(f, 'displayName'), followers: Number(val(f, 'followers')), avatarUrl: optVal(f, 'avatarUrl') }, 'POST', 'Influencer added.');
              if (r.ok) { f.reset(); await load(); setOpen(r.json.id); }
            }}
          >
            <label>X handle<input name="handle" placeholder="example_user" required maxLength={16} pattern="@?[A-Za-z0-9_]{1,15}" /><Hint>Without the @ is fine. 1 to 15 letters, numbers or underscores.</Hint></label>
            <label>Display name<input name="displayName" placeholder="Shown on the rating page" required maxLength={60} /><Hint>Type it as shown on their X profile. It is not filled in automatically.</Hint></label>
            <label>Followers<input name="followers" type="number" min={MIN_FOLLOWERS} step={1} placeholder="Current follower count" required /><Hint>{followerHint()}</Hint></label>
            <label>Avatar URL (optional)<input name="avatarUrl" type="url" placeholder="https://" /><Hint>Link to the profile picture. Leave empty if unsure.</Hint></label>
            <div className="full"><button className="btn primary" type="submit" disabled={ctx.busy}>Add influencer</button></div>
          </form>
        </Section>

        <Section title={`Influencers (${rows.length})`}>
          {rows.length === 0 ? <p>None yet. Add the first account above.</p> : (
            <Table head={['Account', 'Name', 'Status', 'Followers', 'Calls', 'Wallets', 'Promotions', '']}>
              {rows.map((i) => (
                <tr key={i.id}>
                  <td>@{i.handle}</td><td>{i.displayName ?? '-'}</td><td>{i.status.replace('_', ' ')}</td>
                  <td>{(i.accounts[0]?.followers ?? 0).toLocaleString('en-US')}</td>
                  <td>{i._count.calls}</td><td>{i._count.wallets}</td><td>{i._count.promotions}</td>
                  <td><button className="btn" onClick={() => setOpen(i.id)}>Open</button></td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}

interface TipRow { id: string; kind: string; evidenceUrl: string; note: string | null; status: string; createdAt: string; influencer: { handle: string } }

export function TipsPanel({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<TipRow[]>([]);
  const [status, setStatus] = useState('new');
  const load = useCallback(async () => {
    const r = await ctx.call(`/admin/tips${status ? `?status=${status}` : ''}`);
    if (r.ok) setRows(r.json);
  }, [ctx, status]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

  return (
    <div className="box" style={panel}>
      <Section title={`Desk tips (${rows.length})`} hint="Tips are evidence, not votes. The sender is never shown. Accepting a tip does not change a rating by itself: add it as promotion evidence on the account.">
        <div style={row}>
          {['new', 'accepted', 'rejected', 'duplicate', ''].map((s) => (
            <button key={s || 'all'} className={`btn${status === s ? ' primary' : ''}`} onClick={() => setStatus(s)}>{s || 'all'}</button>
          ))}
        </div>
        {rows.length === 0 ? <p>No tips here.</p> : (
          <Table head={['Account', 'Kind', 'Evidence', 'Note', 'Status', 'Received', 'Decide']}>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>@{t.influencer.handle}</td><td>{t.kind.replace(/_/g, ' ')}</td>
                <td><a href={t.evidenceUrl} target="_blank" rel="noreferrer">{shorten(t.evidenceUrl, 26)}</a></td>
                <td>{t.note ? shorten(t.note, 40) : '-'}</td><td>{t.status}</td><td>{stamp(t.createdAt)}</td>
                <td style={row}>
                  {(['accepted', 'rejected', 'duplicate'] as const).map((s) => (
                    <button key={s} className="btn" disabled={ctx.busy || t.status === s} onClick={async () => { const r = await ctx.call(`/admin/tips/${t.id}/review`, { status: s }, 'POST', `Tip marked ${s}.`); if (r.ok) load(); }}>{s}</button>
                  ))}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}

interface TakedownRow { id: string; handle: string; reason: string; contact: string | null; status: string; createdAt: string; decisionNote: string | null; account: { id: string; handle: string } | null }

export function TakedownPanel({ ctx, isAdmin }: { ctx: Ctx; isAdmin: boolean }) {
  const [rows, setRows] = useState<TakedownRow[]>([]);
  const load = useCallback(async () => {
    const r = await ctx.call('/admin/takedown-requests');
    if (r.ok) setRows(r.json);
  }, [ctx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div className="box" style={panel}>
      <Section title={`Takedown requests (${rows.length})`} hint={isAdmin ? 'Review each request against the coverage rules. Accepting a request records the decision. Removing the account is a separate admin step on the influencer page.' : 'Review each request against the coverage rules. Removing an account is an admin step.'}>
        {rows.length === 0 ? <p>No requests.</p> : (
          <Table head={['Account', 'Reason', 'Contact', 'Status', 'Received', 'Decision']}>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>@{t.handle}{t.account ? '' : ' (not covered)'}</td>
                <td className="wrap">{t.reason}</td><td>{t.contact ?? '-'}</td><td>{t.status}</td><td>{stamp(t.createdAt)}</td>
                <td>
                  {t.status === 'new' ? (
                    <form style={row} onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null; const r = await ctx.call(`/admin/takedown-requests/${t.id}/review`, { status: submitter?.value, note: optVal(f, 'note') }, 'POST', 'Decision recorded.'); if (r.ok) load(); }}>
                      <input name="note" placeholder="Decision note" maxLength={1000} style={{ width: 160 }} />
                      <button className="btn" value="accepted" disabled={ctx.busy}>Accept</button>
                      <button className="btn" value="rejected" disabled={ctx.busy}>Reject</button>
                    </form>
                  ) : (t.decisionNote ?? '-')}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}

interface ActionRow { id: string; actionId: string; status: string; totalScore: number | null; scorecardRating: string | null; rating: string | null; createdAt: string; influencer: { handle: string } }
interface ActionDetail extends ActionRow {
  accuracy: number | null; disclosure: number | null; walletAlignment: number | null; conduct: number | null; indicatedRating: string | null;
  appliedCaps: string[]; isDefault: boolean; notRated: boolean; measurableCalls: number; inputs: unknown; suggestedOutlook: string | null;
  noticeChannel: string | null; noticeProofUrl: string | null; publishAfter: string | null; rationale: string | null;
  votes: { id: string; recused: boolean; rating: string | null; outlook: string | null; staff: { name: string } }[];
  appeal: { status: string; reason: string } | null;
}

export function DraftsPanel({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [open, setOpen] = useState<ActionDetail | null>(null);
  const load = useCallback(async () => {
    const r = await ctx.call('/admin/actions');
    if (r.ok) setRows(r.json);
  }, [ctx]);
  const show = useCallback(async (id: string) => {
    const r = await ctx.call(`/admin/actions/${id}`);
    if (r.ok) setOpen(r.json);
  }, [ctx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const act = async (path: string, body: unknown, done: string) => {
    const r = await ctx.call(path, body, 'POST', done);
    if (r.ok && open) { await show(open.id); await load(); }
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {open && (
        <div className="box" style={panel}>
          <div style={{ ...row, justifyContent: 'space-between' }}>
            <div><span className="eyebrow chip">{open.status.toUpperCase()}</span><h2 style={{ marginTop: 8 }}>{open.actionId} · @{open.influencer.handle}</h2></div>
            <button className="btn" onClick={() => setOpen(null)}>Close</button>
          </div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 0 }}>
            <div className="stat"><b>{open.accuracy ?? '-'}</b><span>Call accuracy (35)</span></div>
            <div className="stat"><b>{open.disclosure ?? '-'}</b><span>Disclosure (25)</span></div>
            <div className="stat"><b>{open.walletAlignment ?? '-'}</b><span>Wallet alignment (25)</span></div>
            <div className="stat"><b>{open.conduct ?? '-'}</b><span>Conduct (15)</span></div>
          </div>
          <p>
            Total {open.totalScore ?? '-'} · indicated {open.indicatedRating ?? '-'} · scorecard rating <b>{open.scorecardRating ?? '-'}</b>
            {open.isDefault ? ' · default D applies' : ''}{open.notRated ? ' · not rated' : ''} · {open.measurableCalls} measurable calls
            {open.appliedCaps.length ? ` · caps: ${open.appliedCaps.join(', ')}` : ''}{open.suggestedOutlook ? ` · suggested outlook ${open.suggestedOutlook}` : ''}
          </p>
          <p>The scorecard is calculated by the server from the recorded data. A draft can be recalculated after data fixes. The committee decides the final rating.</p>
          {open.status === 'draft' && (
            <div style={row}>
              <button className="btn" disabled={ctx.busy} onClick={() => act(`/admin/actions/${open.id}/recompute`, {}, 'Scorecard recalculated.')}>Recalculate</button>
              <button className="btn primary" disabled={ctx.busy} onClick={() => act(`/admin/actions/${open.id}/submit`, {}, 'Sent to the committee.')}>Send to committee</button>
            </div>
          )}
          {open.status === 'notice' && open.noticeChannel === 'x_mention' && !open.noticeProofUrl && (
            <Section title="Record the notice" hint="The account is not claimed. Post a public mention on X by hand, then paste the post URL. This starts the notice clock.">
              <form className="form" onSubmit={async (e) => { e.preventDefault(); await act(`/committee/actions/${open.id}/notice-proof`, { url: val(e.currentTarget, 'url') }, 'Notice recorded. The notice period has started.'); }}>
                <label className="full">URL of the public X post<input name="url" type="url" placeholder="https://x.com/.../status/..." required /></label>
                <div className="full"><button className="btn" disabled={ctx.busy}>Record notice</button></div>
              </form>
            </Section>
          )}
          {open.status === 'notice' && <p>Notice channel: {open.noticeChannel === 'profile' ? 'claimed profile' : 'X mention'}. Publishable after {stamp(open.publishAfter)}.</p>}
          {open.rating && <p>Committee rating: <b>{open.rating}</b>{open.rationale ? ` · rationale: ${open.rationale}` : ''}</p>}
          {open.votes.length > 0 && (
            <Table head={['Member', 'Vote', 'Outlook']}>
              {open.votes.map((v) => <tr key={v.id}><td>{v.staff.name}</td><td>{v.recused ? 'recused' : v.rating}</td><td>{v.outlook ?? '-'}</td></tr>)}
            </Table>
          )}
          {open.appeal && <p>Appeal ({open.appeal.status}): {open.appeal.reason}</p>}
        </div>
      )}

      <div className="box" style={panel}>
        <Section title={`Rating drafts and actions (${rows.length})`} hint="Create a draft from an influencer page. Newest first, latest 50.">
          {rows.length === 0 ? <p>No rating actions yet.</p> : (
            <Table head={['Action', 'Account', 'Status', 'Score', 'Scorecard', 'Rating', 'Created', '']}>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{a.actionId}</td><td>@{a.influencer.handle}</td><td>{a.status}</td><td>{a.totalScore ?? '-'}</td>
                  <td>{a.scorecardRating ?? '-'}</td><td>{a.rating ?? '-'}</td><td>{stamp(a.createdAt)}</td>
                  <td><button className="btn" onClick={() => show(a.id)}>Open</button></td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </div>
  );
}

interface ApplicationRow {
  id: string; handle: string; displayName: string; followers: number; status: string; evidenceUrls: string[];
  consentAt: string | null; decisionNote: string | null; createdAt: string;
}

export function ApplicationsPanel({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<ApplicationRow[]>([]);
  const [status, setStatus] = useState('submitted');
  const load = useCallback(async () => {
    const r = await ctx.call(`/admin/applications?status=${status}`);
    if (r.ok) setRows(r.json);
  }, [ctx, status]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [status]);

  return (
    <div className="box" style={panel}>
      <Section
        title={`Applications (${rows.length})`}
        hint="An account owner proved the handle with Login with X. Followers and name come from X. Open each post and check that the account regularly gives token calls. Accepting creates the account, already claimed. A rejection note is shown to the applicant."
      >
        <div style={row}>
          {['submitted', 'accepted', 'rejected'].map((s) => (
            <button key={s} className={`btn${status === s ? ' primary' : ''}`} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
        {rows.length === 0 ? <p>No applications here.</p> : (
          <Table head={['Account', 'Followers', 'Evidence posts', 'Applied', 'Decision']}>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><a href={`https://x.com/${a.handle}`} target="_blank" rel="noreferrer">@{a.handle}</a><br />{a.displayName}</td>
                <td>{a.followers.toLocaleString('en-US')}</td>
                <td className="wrap">{a.evidenceUrls.map((u, i) => <div key={u}><a href={u} target="_blank" rel="noreferrer">Post {i + 1}</a></div>)}</td>
                <td>{stamp(a.createdAt)}</td>
                <td>
                  {a.status === 'submitted' ? (
                    <form
                      style={row}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
                        const r = await ctx.call(`/admin/applications/${a.id}/review`, { status: submitter?.value, note: optVal(f, 'note') }, 'POST', submitter?.value === 'accepted' ? 'Accepted. The account was created and claimed.' : 'Rejected. The applicant sees the note.');
                        if (r.ok) load();
                      }}
                    >
                      <input name="note" placeholder="Note for the applicant (required to reject)" maxLength={1000} style={{ width: 220 }} />
                      <button className="btn primary" value="accepted" formNoValidate disabled={ctx.busy}>Accept</button>
                      <button className="btn" value="rejected" formNoValidate disabled={ctx.busy}>Reject</button>
                    </form>
                  ) : (a.decisionNote ?? '-')}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
