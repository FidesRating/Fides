'use client';

import { useCallback, useEffect, useState } from 'react';
import { CHAINS, Ctx, Hint, MIN_FOLLOWERS, followerHint, Section, SnapshotForm, Table, checked, num, optNum, optVal, panel, row, shorten, stamp, val } from './shared';

interface Account { id: string; platform: string; handle: string; followers: number | null; claimedAt: string | null; claimPending: boolean }
interface WalletRow { id: string; chainKey: string; address: string; method: string; sourceUrl: string | null }
interface PromotionRow { id: string; callId: string | null; source: string; evidenceUrl: string; disclosed: boolean; amountUsd: string | null; status: string; note: string | null }
interface CallRow {
  id: string; postUrl: string; postedAt: string; tokenSymbol: string; chainKey: string | null; direction: string; priceAtCall: string;
  price7d: string | null; price30d: string | null; price90d: string | null; sponsoredDisclosed: boolean;
  deletedAt: string | null; retractedAt: string | null; projectRugConfirmedAt: string | null;
  walletChecks: { walletId: string; heldAtCall: boolean; soldPct7d: string }[];
}
interface Detail {
  id: string; handle: string; displayName: string | null; avatarUrl: string | null; status: string; participating: boolean;
  accounts: Account[]; wallets: WalletRow[]; promotions: PromotionRow[]; calls: CallRow[];
}

const SOURCES = ['project_disclosure', 'public_admission', 'onchain_payment', 'invoice', 'tip'];
const pretty = (s: string) => s.replace(/_/g, ' ');

export default function InfluencerDetail({ ctx, id, isAdmin, onChanged, onClose }: { ctx: Ctx; id: string; isAdmin: boolean; onChanged: () => void; onClose: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [editCall, setEditCall] = useState<string | null>(null);
  const [snapFor, setSnapFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await ctx.call(`/admin/influencers/${id}`);
    if (r.ok) setD(r.json);
  }, [ctx, id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [id]);

  /** Runs a write, then refreshes this account and the list above. */
  const act = async (path: string, body: unknown, method: string, done: string) => {
    const r = await ctx.call(path, body, method, done);
    if (r.ok) { await load(); onChanged(); }
    return r;
  };

  if (!d) return <div className="box" style={panel}><p>Loading account...</p></div>;
  const removed = d.status === 'removed';
  const claimPending = d.accounts.some((a) => a.claimPending);

  return (
    <div className="box" style={panel}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <div>
          <span className="eyebrow chip">{d.status.replace('_', ' ').toUpperCase()}</span>
          <h2 style={{ marginTop: 8 }}>@{d.handle}{d.displayName ? `, ${d.displayName}` : ''}</h2>
          <p>{d.participating ? 'Claimed: the account takes part and sees notices on its profile.' : 'Not claimed: notices are sent by a manual X mention.'}</p>
        </div>
        <button className="btn" onClick={onClose}>Close</button>
      </div>

      {removed ? <p>This account was removed from coverage. It is read only.</p> : (
        <>
          <div style={row}>
            {claimPending && <button className="btn" disabled={ctx.busy} onClick={() => act(`/admin/influencers/${id}/confirm-claim`, {}, 'POST', 'Claim confirmed.')}>Confirm pending claim</button>}
            <button className="btn primary" disabled={ctx.busy} onClick={() => act(`/admin/influencers/${id}/actions`, undefined, 'POST', 'Rating draft created. Open it in the Rating drafts tab.')}>Create rating draft</button>
          </div>

          <Section title="Profile">
            <form className="form" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; await act(`/admin/influencers/${id}`, { displayName: optVal(f, 'displayName'), avatarUrl: optVal(f, 'avatarUrl') }, 'PATCH', 'Profile updated.'); }}>
              <label>Display name<input name="displayName" defaultValue={d.displayName ?? ''} maxLength={60} /></label>
              <label>Avatar URL (optional)<input name="avatarUrl" type="url" placeholder="https://" defaultValue={d.avatarUrl ?? ''} /></label>
              <div className="full"><button className="btn" disabled={ctx.busy}>Save profile</button></div>
            </form>
          </Section>

          <Section title="Accounts" hint="Followers must stay at or above the coverage minimum.">
            <Table head={['Handle', 'Platform', 'Followers', 'Claim', 'Update followers']}>
              {d.accounts.map((a) => (
                <tr key={a.id}>
                  <td>@{a.handle}</td><td>{a.platform}</td><td>{(a.followers ?? 0).toLocaleString('en-US')}</td>
                  <td>{a.claimedAt ? 'claimed' : a.claimPending ? 'pending' : '-'}</td>
                  <td>
                    <form style={row} onSubmit={async (e) => { e.preventDefault(); await act(`/admin/accounts/${a.id}`, { followers: Number(val(e.currentTarget, 'followers')) }, 'PATCH', 'Followers updated.'); }}>
                      <input name="followers" type="number" min={0} required style={{ width: 110 }} />
                      <button className="btn" disabled={ctx.busy}>Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </Table>
            <form className="form" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const r = await act(`/admin/influencers/${id}/accounts`, { handle: val(f, 'handle'), followers: Number(val(f, 'followers')) }, 'POST', 'Account added.'); if (r.ok) f.reset(); }}>
              <label>Another X handle<input name="handle" required maxLength={16} pattern="@?[A-Za-z0-9_]{1,15}" /></label>
              <label>Followers<input name="followers" type="number" min={MIN_FOLLOWERS} required /><Hint>{followerHint()}</Hint></label>
              <div className="full"><button className="btn" disabled={ctx.busy}>Add account</button></div>
            </form>
          </Section>

          <Section title={`Calls (${d.calls.length})`} hint="Prices come from the analyst. Record where they were taken from.">
            {d.calls.length === 0 ? <p>No calls recorded yet.</p> : (
              <Table head={['Token', 'Posted', 'Price at call', '7d', '30d', '90d', 'Flags', '']}>
                {d.calls.map((c) => (
                  <tr key={c.id}>
                    <td><a href={c.postUrl} target="_blank" rel="noreferrer">{c.tokenSymbol}</a> {c.direction}</td>
                    <td>{stamp(c.postedAt)}</td><td>{num(c.priceAtCall)}</td><td>{num(c.price7d)}</td><td>{num(c.price30d)}</td><td>{num(c.price90d)}</td>
                    <td>{[c.deletedAt && 'deleted', c.retractedAt && 'retracted', c.projectRugConfirmedAt && 'rug', c.sponsoredDisclosed && 'disclosed'].filter(Boolean).join(', ') || '-'}</td>
                    <td><button className="btn" onClick={() => setEditCall(editCall === c.id ? null : c.id)}>{editCall === c.id ? 'Close' : 'Edit'}</button></td>
                  </tr>
                ))}
              </Table>
            )}
            {d.calls.filter((c) => c.id === editCall).map((c) => (
              <CallEditor key={c.id} ctx={ctx} call={c} wallets={d.wallets} act={act} reload={load} />
            ))}
            <h4>Add a call</h4>
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const r = await act(`/admin/influencers/${id}/calls`, {
                  calls: [{
                    postUrl: val(f, 'postUrl'), postedAt: new Date(val(f, 'postedAt')).toISOString(), tokenSymbol: val(f, 'tokenSymbol'),
                    chain: optVal(f, 'chain'), tokenAddress: optVal(f, 'tokenAddress'), direction: optVal(f, 'direction'),
                    sponsoredDisclosed: checked(f, 'sponsoredDisclosed'), priceAtCall: Number(val(f, 'priceAtCall')), btcAtCall: Number(val(f, 'btcAtCall')),
                    price7d: optNum(f, 'price7d'), price30d: optNum(f, 'price30d'), price90d: optNum(f, 'price90d'),
                    btc7d: optNum(f, 'btc7d'), btc30d: optNum(f, 'btc30d'), btc90d: optNum(f, 'btc90d'), priceSourceRef: optVal(f, 'priceSourceRef'),
                  }],
                }, 'POST', 'Call added.');
                if (r.ok) f.reset();
              }}
            >
              <label className="full">Post URL<input name="postUrl" type="url" placeholder="https://x.com/.../status/..." required /></label>
              <label>Posted at<input name="postedAt" type="datetime-local" required /></label>
              <label>Token symbol<input name="tokenSymbol" maxLength={20} required /></label>
              <label>Chain (optional)<select name="chain" defaultValue=""><option value="">none</option>{CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label>Token address (optional)<input name="tokenAddress" /></label>
              <label>Direction<select name="direction" defaultValue="long"><option value="long">long</option><option value="short">short</option></select></label>
              <label>Price at call<input name="priceAtCall" type="number" step="any" min={0} required /></label>
              <label>BTC at call<input name="btcAtCall" type="number" step="any" min={0} required /></label>
              <label>Price 7d<input name="price7d" type="number" step="any" min={0} /></label>
              <label>BTC 7d<input name="btc7d" type="number" step="any" min={0} /></label>
              <label>Price 30d<input name="price30d" type="number" step="any" min={0} /></label>
              <label>BTC 30d<input name="btc30d" type="number" step="any" min={0} /></label>
              <label>Price 90d<input name="price90d" type="number" step="any" min={0} /></label>
              <label>BTC 90d<input name="btc90d" type="number" step="any" min={0} /></label>
              <label className="full">Price source (exchange, pool or document)<input name="priceSourceRef" maxLength={200} /></label>
              <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name="sponsoredDisclosed" type="checkbox" style={{ width: 'auto' }} /> The post disclosed that it was sponsored</label>
              <div className="full"><button className="btn primary" disabled={ctx.busy}>Add call</button></div>
            </form>
          </Section>

          <Section title={`Wallets (${d.wallets.length})`} hint="Only wallets the account named itself in a public post. No guessed or clustered wallets.">
            {d.wallets.length > 0 && (
              <Table head={['Chain', 'Address', 'Method', 'Source', '']}>
                {d.wallets.map((w) => (
                  <tr key={w.id}>
                    <td>{w.chainKey}</td><td>{shorten(w.address, 22)}</td><td>{pretty(w.method)}</td><td>{w.sourceUrl ? <a href={w.sourceUrl} target="_blank" rel="noreferrer">post</a> : '-'}</td>
                    <td>{isAdmin && <button className="btn" disabled={ctx.busy} onClick={() => { if (window.confirm('Remove this wallet? The owner can then save the right one. A wallet used in call checks cannot be removed.')) act(`/admin/influencers/${id}/wallets/${w.id}/remove`, {}, 'POST', 'Wallet removed.'); }}>Remove</button>}</td>
                  </tr>
                ))}
              </Table>
            )}
            <form className="form" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const r = await act(`/admin/influencers/${id}/wallets`, { chain: val(f, 'chain'), address: val(f, 'address'), sourceUrl: val(f, 'sourceUrl') }, 'POST', 'Wallet added.'); if (r.ok) f.reset(); }}>
              <label>Chain<select name="chain" defaultValue="ethereum">{CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
              <label>Address<input name="address" required /></label>
              <label className="full">Public post where the account named this wallet<input name="sourceUrl" type="url" placeholder="https://x.com/.../status/..." required /></label>
              <div className="full"><button className="btn" disabled={ctx.busy}>Add wallet</button></div>
            </form>
          </Section>

          <Section title={`Promotion evidence (${d.promotions.length})`} hint="Pending items block submitting a rating draft to the committee.">
            {d.promotions.length > 0 && (
              <Table head={['Source', 'Evidence', 'Disclosed', 'Amount (USD)', 'Status', '']}>
                {d.promotions.map((p) => (
                  <tr key={p.id}>
                    <td>{pretty(p.source)}</td><td><a href={p.evidenceUrl} target="_blank" rel="noreferrer">{shorten(p.evidenceUrl, 28)}</a></td>
                    <td>{p.disclosed ? 'yes' : 'no'}</td><td>{num(p.amountUsd)}</td><td>{p.status}</td>
                    <td style={row}>
                      {p.status === 'pending' && (
                        <>
                          <button className="btn" disabled={ctx.busy} onClick={() => act(`/admin/promotions/${p.id}/review`, { status: 'confirmed' }, 'POST', 'Evidence confirmed.')}>Confirm</button>
                          <button className="btn" disabled={ctx.busy} onClick={() => act(`/admin/promotions/${p.id}/review`, { status: 'rejected' }, 'POST', 'Evidence rejected.')}>Reject</button>
                        </>
                      )}
                      <button className="btn" onClick={() => setSnapFor(snapFor === p.id ? null : p.id)}>Snapshot</button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {snapFor && d.promotions.some((p) => p.id === snapFor) && <SnapshotForm ctx={ctx} path={`/admin/promotions/${snapFor}/snapshots`} onDone={() => setSnapFor(null)} />}
            <form
              className="form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = e.currentTarget;
                const r = await act(`/admin/influencers/${id}/promotions`, {
                  callId: optVal(f, 'callId'), source: val(f, 'source'), evidenceUrl: val(f, 'evidenceUrl'), disclosed: checked(f, 'disclosed'),
                  amountUsd: optNum(f, 'amountUsd'), note: optVal(f, 'note'),
                }, 'POST', 'Evidence added as pending.');
                if (r.ok) f.reset();
              }}
            >
              <label>Source<select name="source" defaultValue="project_disclosure">{SOURCES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}</select></label>
              <label>Related call (optional)<select name="callId" defaultValue=""><option value="">none</option>{d.calls.map((c) => <option key={c.id} value={c.id}>{c.tokenSymbol} {stamp(c.postedAt)}</option>)}</select></label>
              <label className="full">Public evidence URL<input name="evidenceUrl" type="url" placeholder="https://" required /></label>
              <label>Amount in USD (optional)<input name="amountUsd" type="number" step="any" min={0} /></label>
              <label>Note (optional)<input name="note" maxLength={500} /></label>
              <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name="disclosed" type="checkbox" style={{ width: 'auto' }} /> The account disclosed this promotion</label>
              <div className="full"><button className="btn" disabled={ctx.busy}>Add evidence</button></div>
            </form>
          </Section>

          {isAdmin && <RemoveBox ctx={ctx} onRemove={(reason) => act(`/admin/influencers/${id}/remove`, { reason }, 'POST', 'Account removed from coverage.')} handle={d.handle} />}
        </>
      )}
    </div>
  );
}

/** Edits one call: late prices, flags, wallet checks and provenance. */
function CallEditor({ ctx, call, wallets, act, reload }: { ctx: Ctx; call: CallRow; wallets: WalletRow[]; act: (p: string, b: unknown, m: string, d: string) => Promise<{ ok: boolean }>; reload: () => Promise<void> }) {
  const check = (walletId: string) => call.walletChecks.find((c) => c.walletId === walletId);
  return (
    <div className="box" style={{ ...panel, background: 'var(--paper-3)' }}>
      <h4>Edit {call.tokenSymbol}</h4>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          await act(`/admin/calls/${call.id}`, {
            price7d: optNum(f, 'price7d'), price30d: optNum(f, 'price30d'), price90d: optNum(f, 'price90d'),
            btc7d: optNum(f, 'btc7d'), btc30d: optNum(f, 'btc30d'), btc90d: optNum(f, 'btc90d'), archiveUrl: optVal(f, 'archiveUrl'),
            deleted: checked(f, 'deleted'), rugConfirmed: checked(f, 'rugConfirmed'), retracted: checked(f, 'retracted'),
          }, 'PATCH', 'Call updated.');
        }}
      >
        <label>Price 7d<input name="price7d" type="number" step="any" min={0} defaultValue={call.price7d ?? ''} /></label>
        <label>BTC 7d<input name="btc7d" type="number" step="any" min={0} /></label>
        <label>Price 30d<input name="price30d" type="number" step="any" min={0} defaultValue={call.price30d ?? ''} /></label>
        <label>BTC 30d<input name="btc30d" type="number" step="any" min={0} /></label>
        <label>Price 90d<input name="price90d" type="number" step="any" min={0} defaultValue={call.price90d ?? ''} /></label>
        <label>BTC 90d<input name="btc90d" type="number" step="any" min={0} /></label>
        <label className="full">Archive URL (optional)<input name="archiveUrl" type="url" placeholder="https://" /></label>
        <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name="deleted" type="checkbox" defaultChecked={!!call.deletedAt} style={{ width: 'auto' }} /> The post was deleted</label>
        <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name="retracted" type="checkbox" defaultChecked={!!call.retractedAt} style={{ width: 'auto' }} /> The account retracted the call</label>
        <label className="full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name="rugConfirmed" type="checkbox" defaultChecked={!!call.projectRugConfirmedAt} style={{ width: 'auto' }} /> The project rug is confirmed</label>
        <div className="full"><button className="btn primary" disabled={ctx.busy}>Save call</button></div>
      </form>

      {wallets.length > 0 && (
        <>
          <h4>Wallet checks</h4>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              const checks = wallets
                .filter((w) => checked(f, `use-${w.id}`))
                .map((w) => ({ walletId: w.id, heldAtCall: checked(f, `held-${w.id}`), soldPct7d: Number(val(f, `sold-${w.id}`) || 0) }));
              await act(`/admin/calls/${call.id}/wallet-checks`, { checks }, 'PUT', 'Wallet checks saved.');
            }}
          >
            {wallets.map((w) => (
              <div key={w.id} className="full" style={row}>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name={`use-${w.id}`} type="checkbox" defaultChecked={!!check(w.id)} style={{ width: 'auto' }} /> {w.chainKey} {shorten(w.address, 16)}</label>
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input name={`held-${w.id}`} type="checkbox" defaultChecked={check(w.id)?.heldAtCall ?? false} style={{ width: 'auto' }} /> held at call</label>
                <label>Sold within 7d (0 to 1)<input name={`sold-${w.id}`} type="number" step="any" min={0} max={1} defaultValue={check(w.id)?.soldPct7d ?? 0} style={{ width: 120 }} /></label>
              </div>
            ))}
            <div className="full"><button className="btn" disabled={ctx.busy}>Save wallet checks</button></div>
          </form>
        </>
      )}

      <h4>Evidence snapshot for this call</h4>
      <SnapshotForm ctx={ctx} path={`/admin/calls/${call.id}/snapshots`} onDone={reload} />
    </div>
  );
}

/** Takedown: only an admin, and only after typing the handle, because the account then answers 410 Gone everywhere. */
function RemoveBox({ ctx, handle, onRemove }: { ctx: Ctx; handle: string; onRemove: (reason: string) => Promise<unknown> }) {
  return (
    <Section title="Remove from coverage" hint="Admin only. The account disappears from every public page and answers 410 Gone. Open rating drafts are cancelled.">
      <form className="form" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; if (val(f, 'confirm').replace(/^@/, '').toLowerCase() !== handle.toLowerCase()) return; await onRemove(val(f, 'reason')); }}>
        <label className="full">Reason (kept internally)<input name="reason" maxLength={300} required /></label>
        <label className="full">Type the handle to confirm<input name="confirm" placeholder={handle} required /></label>
        <div className="full"><button className="btn" disabled={ctx.busy}>Remove account</button></div>
      </form>
    </Section>
  );
}
