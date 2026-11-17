'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiCall, errorText, readToken, signInWithWallet, signOutSession, writeToken } from '@/lib/session';
import { ApplicationsPanel, DraftsPanel, InfluencersPanel, TakedownPanel, TipsPanel } from './AnalystPanels';
import { CommitteePanel } from './CommitteePanel';
import { Ctx, panel } from './shared';

type Role = 'analyst' | 'committee' | 'admin';
interface StaffMe { role: Role; walletAddress: string }
type Tab = 'influencers' | 'applications' | 'drafts' | 'tips' | 'takedowns' | 'committee';

const TABS: { id: Tab; label: string; roles: Role[] }[] = [
  { id: 'influencers', label: 'Influencers', roles: ['analyst', 'admin'] },
  { id: 'applications', label: 'Applications', roles: ['analyst', 'admin'] },
  { id: 'drafts', label: 'Rating drafts', roles: ['analyst', 'admin'] },
  { id: 'tips', label: 'Desk tips', roles: ['analyst', 'admin'] },
  { id: 'takedowns', label: 'Takedowns', roles: ['analyst', 'admin'] },
  { id: 'committee', label: 'Committee', roles: ['committee'] },
];

// The role comes from the server allowlist. The page only decides what to show: the server checks every call.
export default function StaffConsole() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<StaffMe | null>(null);
  const [tab, setTab] = useState<Tab>('influencers');
  const [influencerCount, setInfluencerCount] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMe = useCallback(async (tok: string) => {
    const m = await apiCall('/staff/me', tok);
    if (m.status === 401) { writeToken(null); setToken(null); setMe(null); return; }
    if (!m.ok) { setMe(null); setMessage(errorText(m)); return; }
    setMessage('');
    setMe(m.json);
    setTab(m.json.role === 'committee' ? 'committee' : 'influencers');
  }, []);

  useEffect(() => {
    const tok = readToken();
    setToken(tok);
    if (tok) loadMe(tok);
  }, [loadMe]);

  async function signIn() {
    setBusy(true);
    setMessage('');
    const r = await signInWithWallet();
    if ('error' in r) setMessage(r.error);
    else { setToken(r.token); await loadMe(r.token); }
    setBusy(false);
  }

  async function signOut() {
    const tok = token;
    setToken(null);
    setMe(null);
    setMessage('');
    setInfluencerCount(null);
    setQueueCount(null);
    await signOutSession(tok);
  }

  /** One API caller for every panel: it shows failures, and the success text when a write passes one. */
  const call = useCallback<Ctx['call']>(async (path, body, method, done) => {
    if (!token) return { ok: false, status: 0, json: null };
    const write = body !== undefined || (method !== undefined && method !== 'GET');
    if (write) setBusy(true);
    const r = await apiCall(path, token, body, method);
    if (write) setBusy(false);
    if (r.status === 401) { writeToken(null); setToken(null); setMe(null); setMessage('Your session ended. Sign in again.'); }
    else if (!r.ok) setMessage(errorText(r));
    else if (done) setMessage(done);
    return r;
  }, [token]);

  const ctx = useMemo<Ctx>(() => ({ call, busy }), [call, busy]);
  const tabs = me ? TABS.filter((t) => t.roles.includes(me.role)) : [];
  const isAnalyst = me?.role === 'analyst' || me?.role === 'admin';

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      {message && <p className="box" role="status" style={{ padding: '14px 18px', position: 'sticky', top: 96, zIndex: 5 }}>{message}</p>}

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

          <div className="stats" style={{ gridTemplateColumns: `repeat(2, 1fr)`, marginTop: 0 }}>
            <div className="stat"><b style={{ textTransform: 'capitalize' }}>{me.role}</b><span>Your role</span></div>
            {isAnalyst
              ? <div className="stat"><b>{influencerCount ?? '-'}</b><span>Influencers tracked</span></div>
              : <div className="stat"><b>{queueCount ?? '-'}</b><span>Waiting for committee</span></div>}
          </div>

          {me.role === 'admin' && <p className="box" style={{ padding: '14px 18px' }}>Admins do analyst work and remove accounts. Only committee wallets vote, finalize and publish ratings.</p>}

          <div className="btns">
            {tabs.map((t) => <button key={t.id} className={`btn${tab === t.id ? ' primary' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </div>

          {tab === 'influencers' && isAnalyst && <InfluencersPanel ctx={ctx} isAdmin={me.role === 'admin'} onCount={setInfluencerCount} />}
          {tab === 'applications' && isAnalyst && <ApplicationsPanel ctx={ctx} />}
          {tab === 'drafts' && isAnalyst && <DraftsPanel ctx={ctx} />}
          {tab === 'tips' && isAnalyst && <TipsPanel ctx={ctx} />}
          {tab === 'takedowns' && isAnalyst && <TakedownPanel ctx={ctx} isAdmin={me.role === 'admin'} />}
          {tab === 'committee' && me.role === 'committee' && <CommitteePanel ctx={ctx} onCount={setQueueCount} />}
        </>
      )}
    </section>
  );
}
