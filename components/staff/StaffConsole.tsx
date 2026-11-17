'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiCall, errorText, readToken, signInWithWallet, signOutSession, writeToken } from '@/lib/session';

type Role = 'analyst' | 'committee' | 'admin';
interface StaffMe { role: Role; walletAddress: string }
interface InfluencerRow {
  id: string; handle: string; displayName: string | null; status: string;
  accounts: { id: string; handle: string; followers: number | null }[];
  _count: { calls: number; wallets: number; promotions: number };
}
interface QueueRow {
  id: string; actionId: string; status: string;
  influencer: { handle: string; displayName: string | null };
  scorecard: { totalScore: number | null; scorecardRating: string | null };
  votesCast: number; conflicted: boolean; publishAfter: string | null;
}

// Read-only first version: it shows who is signed in and what that role can see. Write actions come later.
export default function StaffConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<StaffMe | null>(null);
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([]);
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (tok: string) => {
    const m = await apiCall('/staff/me', tok);
    if (m.status === 401) { writeToken(null); setToken(null); setMe(null); return; }
    if (!m.ok) { setMe(null); setMessage(errorText(m)); return; }
    setMessage('');
    setMe(m.json);
    const role: Role = m.json.role;
    if (role === 'analyst' || role === 'admin') {
      const r = await apiCall('/admin/influencers', tok);
      if (r.ok) setInfluencers(r.json);
    }
    if (role === 'committee' || role === 'admin') {
      const r = await apiCall('/committee/queue', tok);
      if (r.ok) setQueue(r.json);
    }
  }, []);

  useEffect(() => {
    const tok = readToken();
    setToken(tok);
    if (tok) load(tok);
  }, [load]);

  async function signIn() {
    setBusy(true);
    setMessage('');
    const r = await signInWithWallet();
    if ('error' in r) setMessage(r.error);
    else { setToken(r.token); await load(r.token); }
    setBusy(false);
  }

  async function signOut() {
    const tok = token;
    setToken(null);
    setMe(null);
    setInfluencers([]);
    setQueue([]);
    setMessage('');
    await signOutSession(tok);
  }

  async function addInfluencer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const r = await apiCall('/admin/influencers', token, {
      handle: String(data.get('handle') ?? '').trim(),
      displayName: String(data.get('displayName') ?? '').trim(),
      followers: Number(data.get('followers')),
    });
    setBusy(false);
    if (r.ok) { form.reset(); setMessage(`Added @${r.json.handle}.`); await load(token); }
    else setMessage(errorText(r));
  }

  const showAnalyst = me?.role === 'analyst' || me?.role === 'admin';
  const showCommittee = me?.role === 'committee' || me?.role === 'admin';

  const panel: React.CSSProperties = { padding: 22, display: 'grid', gap: 16 };

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      {message && <p className="box" role="status" style={{ padding: '14px 18px' }}>{message}</p>}

      {!token && (
        <div className="box" style={{ ...panel, maxWidth: 560 }}>
          <span className="eyebrow chip" style={{ justifySelf: 'start' }}>STAFF WALLET</span>
          <h2>Sign in with a staff wallet</h2>
          <p>A signature only. No transaction, no fee. Your role comes from the owner-managed wallet list.</p>
          <div className="btns"><button className="btn primary" disabled={busy} onClick={signIn}>Connect wallet</button></div>
        </div>
      )}

      {token && !me && (
        <div className="box" style={{ ...panel, maxWidth: 560 }}>
          <h2>Not on the staff list</h2>
          <p>This wallet is signed in but has no staff role. Sign out and connect a staff wallet.</p>
          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </div>
      )}

      {token && me && (
        <>
          <div className="box" style={{ ...panel, gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center' }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span className="eyebrow chip" style={{ justifySelf: 'start' }}>{me.role.toUpperCase()}</span>
              <h2 style={{ textTransform: 'capitalize' }}>Signed in as {me.role}</h2>
              <p style={{ fontFamily: 'var(--mono)', fontSize: 13, wordBreak: 'break-all' }}>{me.walletAddress}</p>
            </div>
            <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
          </div>

          <div className="stats" style={{ gridTemplateColumns: `repeat(${showAnalyst && showCommittee ? 3 : 2}, 1fr)`, marginTop: 0 }}>
            <div className="stat"><b style={{ textTransform: 'capitalize' }}>{me.role}</b><span>Your role</span></div>
            {showAnalyst && <div className="stat"><b>{influencers.length}</b><span>Influencers tracked</span></div>}
            {showCommittee && <div className="stat"><b>{queue.length}</b><span>Waiting for committee</span></div>}
          </div>

          {showAnalyst && (
            <div className="box" style={panel}>
              <div>
                <h3>Add influencer</h3>
                <p>Public X account only. The server rejects accounts below the follower minimum and handles already tracked.</p>
              </div>
              <form className="form" onSubmit={addInfluencer}>
                <label>X handle<input name="handle" placeholder="example_user" required maxLength={16} pattern="@?[A-Za-z0-9_]{1,15}" /></label>
                <label>Display name<input name="displayName" placeholder="Shown on the rating page" required maxLength={60} /></label>
                <label>Followers<input name="followers" type="number" min={0} step={1} placeholder="25000" required /></label>
                <div className="full"><button className="btn primary" type="submit" disabled={busy}>Add influencer</button></div>
              </form>

              <h3>Influencers ({influencers.length})</h3>
              {influencers.length === 0 ? <p>None yet. Add the first account above.</p> : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Account</th><th>Name</th><th>Status</th><th>Followers</th><th>Calls</th><th>Wallets</th><th>Promotions</th></tr></thead>
                    <tbody>
                      {influencers.map((i) => (
                        <tr key={i.id}>
                          <td>@{i.handle}</td>
                          <td>{i.displayName ?? '-'}</td>
                          <td>{i.status}</td>
                          <td>{(i.accounts[0]?.followers ?? 0).toLocaleString('en-US')}</td>
                          <td>{i._count.calls}</td>
                          <td>{i._count.wallets}</td>
                          <td>{i._count.promotions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {showCommittee && (
            <div className="box" style={panel}>
              <h3>Committee queue ({queue.length})</h3>
              {queue.length === 0 ? <p>Nothing is waiting for a vote.</p> : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Action</th><th>Account</th><th>Status</th><th>Scorecard</th><th>Votes</th><th>Note</th></tr></thead>
                    <tbody>
                      {queue.map((a) => (
                        <tr key={a.id}>
                          <td>{a.actionId}</td>
                          <td>@{a.influencer.handle}</td>
                          <td>{a.status}</td>
                          <td>{a.scorecard.scorecardRating ?? 'n/a'} ({a.scorecard.totalScore ?? 'n/a'})</td>
                          <td>{a.votesCast}</td>
                          <td>{a.conflicted ? 'You are conflicted' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
