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

  const showAnalyst = me?.role === 'analyst' || me?.role === 'admin';
  const showCommittee = me?.role === 'committee' || me?.role === 'admin';

  return (
    <section className="box" style={{ padding: 24, display: 'grid', gap: 22 }}>
      {message && <p role="status">{message}</p>}

      {!token && (
        <>
          <h2>Sign in with a staff wallet</h2>
          <p>A signature only. No transaction, no fee.</p>
          <div className="btns"><button className="btn primary" disabled={busy} onClick={signIn}>Connect wallet</button></div>
        </>
      )}

      {token && !me && (
        <>
          <p>This wallet is signed in but is not on the staff list.</p>
          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </>
      )}

      {token && me && (
        <>
          <div>
            <h2>Signed in as {me.role}</h2>
            <p>{me.walletAddress}</p>
          </div>

          {showAnalyst && (
            <div>
              <h3>Influencers ({influencers.length})</h3>
              {influencers.length === 0 ? <p>None yet.</p> : (
                <ul>
                  {influencers.map((i) => (
                    <li key={i.id}>
                      @{i.handle} · {i.status} · {i._count.calls} calls · {i._count.wallets} wallets · {i._count.promotions} promotions
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {showCommittee && (
            <div>
              <h3>Committee queue ({queue.length})</h3>
              {queue.length === 0 ? <p>Nothing waiting.</p> : (
                <ul>
                  {queue.map((a) => (
                    <li key={a.id}>
                      {a.actionId} · @{a.influencer.handle} · {a.status} · scorecard {a.scorecard.scorecardRating ?? 'n/a'}
                      {' '}({a.scorecard.totalScore ?? 'n/a'}) · {a.votesCast} votes{a.conflicted ? ' · you are conflicted' : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </>
      )}
    </section>
  );
}
