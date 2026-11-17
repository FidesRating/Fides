'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall, errorText, readToken, signInWithWallet, signOutSession, writeToken } from '@/lib/session';

interface Notice { actionId: string; rating: string | null; publishAfter: string | null; message: string }
interface Current {
  actionId: string; rating: string | null; reply: string | null;
  appeal: { status: string } | null; appealDeadline: string | null;
}
interface Profile { handle: string; participating: boolean; notices: Notice[]; current: Current | null }
interface Application {
  handle: string; displayName: string; followers: number; status: 'draft' | 'submitted' | 'accepted' | 'rejected';
  decisionNote: string | null; decidedAt: string | null;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toUTCString() : '');

export default function ClaimFlow() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // The code and state X sends back are kept until the wallet is signed in.
  const pending = useRef<{ code: string; state: string } | null>(null);

  const call = apiCall;

  const loadProfile = useCallback(async (tok: string) => {
    const r = await call('/claim/me', tok);
    if (r.status === 401) { writeToken(null); setToken(null); return; }
    setProfile(r.ok ? r.json : null);
    // Not a covered account yet: show the application, if there is one.
    if (!r.ok) {
      const a = await call('/claim/application', tok);
      setApplication(a.ok ? a.json : null);
    } else {
      setApplication(null);
    }
  }, [call]);

  const completeX = useCallback(async (tok: string) => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    const r = await call('/claim/x/complete', tok, p);
    setMessage(r.ok ? r.json.message : errorText(r));
    await loadProfile(tok);
  }, [call, loadProfile]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('code'), state = q.get('state');
    if (code && state) {
      pending.current = { code, state };
      window.history.replaceState(null, '', window.location.pathname);
    }
    const tok = readToken();
    setToken(tok);
    if (tok) {
      loadProfile(tok).then(() => completeX(tok));
    } else if (pending.current) {
      setMessage('Sign in with your wallet to finish claiming your profile.');
    }
  }, [loadProfile, completeX]);

  async function signIn() {
    setBusy(true);
    setMessage('');
    const r = await signInWithWallet();
    if ('error' in r) {
      setMessage(r.error);
    } else {
      setToken(r.token);
      await loadProfile(r.token);
      await completeX(r.token);
    }
    setBusy(false);
  }

  async function loginWithX() {
    if (!token) return;
    setBusy(true);
    const r = await call('/claim/x/start', token, {});
    setBusy(false);
    if (r.ok) window.location.assign(r.json.authorizeUrl);
    else setMessage(r.status === 503 ? 'Profile claims are not open yet.' : errorText(r));
  }

  async function submit(path: string, body: Record<string, string>, done: string) {
    if (!token) return;
    setBusy(true);
    const r = await call(path, token, body);
    setBusy(false);
    setMessage(r.ok ? done : errorText(r));
    if (r.ok) await loadProfile(token);
  }

  async function signOut() {
    const tok = token;
    setToken(null);
    setProfile(null);
    setApplication(null);
    setMessage('');
    await signOutSession(tok);
  }

  const onForm = (path: string, fields: string[], done: string) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    submit(path, Object.fromEntries(fields.map((f) => [f, String(data.get(f) ?? '')])), done);
  };

  return (
    <section className="box" style={{ padding: 24, display: 'grid', gap: 18 }}>
      {message && <p role="status">{message}</p>}

      {!token && (
        <>
          <h2>1. Sign in with a wallet</h2>
          <p>A signature only. No transaction, no fee.</p>
          <div className="btns"><button className="btn primary" disabled={busy} onClick={signIn}>Connect wallet</button></div>
        </>
      )}

      {token && !profile && (!application || application.status === 'rejected') && (
        <>
          <h2>2. Log in with X</h2>
          <p>X confirms which account you control. FIDES reads only your username, name, picture and follower count.</p>
          <p>If your account is already covered, you claim it. If it is not covered yet, you can apply for coverage. You can only apply for the account you log in with.</p>
          {application?.status === 'rejected' && (
            <p role="status">Your last application for @{application.handle} was not accepted{application.decisionNote ? `: ${application.decisionNote}` : '.'} A new application is possible 30 days after the decision.</p>
          )}
          <div className="btns">
            <button className="btn primary" disabled={busy} onClick={loginWithX}>Log in with X</button>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
        </>
      )}

      {token && !profile && application?.status === 'draft' && (
        <>
          <h2>3. Apply for coverage</h2>
          <p>
            Verified by X: <b>{application.displayName}</b> (@{application.handle}), {application.followers.toLocaleString('en-US')} followers.
            This part cannot be edited.
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const evidenceUrls = ['e1', 'e2', 'e3', 'e4', 'e5'].map((k) => String(data.get(k) ?? '').trim()).filter(Boolean);
              setBusy(true);
              const r = await call('/claim/application/submit', token, { evidenceUrls, consent: data.get('consent') === 'on' });
              setBusy(false);
              setMessage(r.ok ? r.json.message : errorText(r));
              if (r.ok && token) await loadProfile(token);
            }}
          >
            <p className="full">Link 3 to 5 public X posts where you recommended a token. Staff use them to check that the account regularly gives token calls.</p>
            <label className="full">Post 1<input name="e1" type="url" placeholder="https://x.com/yourname/status/..." required /></label>
            <label className="full">Post 2<input name="e2" type="url" placeholder="https://x.com/yourname/status/..." required /></label>
            <label className="full">Post 3<input name="e3" type="url" placeholder="https://x.com/yourname/status/..." required /></label>
            <label className="full">Post 4 (optional)<input name="e4" type="url" placeholder="https://x.com/yourname/status/..." /></label>
            <label className="full">Post 5 (optional)<input name="e5" type="url" placeholder="https://x.com/yourname/status/..." /></label>
            <label className="full" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, textTransform: 'none', letterSpacing: 0 }}>
              <input name="consent" type="checkbox" required style={{ width: 'auto', marginTop: 4 }} />
              <span>I understand that a FIDES rating is an opinion based on public data and a published methodology. I will get a notice at least 48 hours before publication, and I can reply and appeal once. Applying does not change my rating.</span>
            </label>
            <div className="full btns">
              <button className="btn primary" disabled={busy}>Submit application</button>
              <button type="button" className="btn" onClick={signOut}>Sign out</button>
            </div>
          </form>
        </>
      )}

      {token && !profile && application?.status === 'submitted' && (
        <>
          <h2>Application under review</h2>
          <p>Your application for @{application.handle} was sent. Staff review the evidence. The decision will appear on this page, so sign in again later to see it.</p>
          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </>
      )}

      {token && profile && (
        <>
          <h2>@{profile.handle} {profile.participating && <small>Participating</small>}</h2>
          <p>Claiming never raises a rating. The scorecard, caps and committee rules are the same for everyone.</p>

          {profile.notices.map((n) => (
            <div key={n.actionId}>
              <h3>Notice {n.actionId}</h3>
              <p>Proposed rating {n.rating}. Publication not before {fmt(n.publishAfter)}.</p>
              <p>{n.message}</p>
            </div>
          ))}

          {profile.current && (
            <div>
              <h3>Published rating {profile.current.rating}</h3>
              {profile.current.reply && <p>Your reply: {profile.current.reply}</p>}
              {profile.current.appeal
                ? <p>Appeal status: {profile.current.appeal.status}</p>
                : <p>You can appeal once, until {fmt(profile.current.appealDeadline)}.</p>}
            </div>
          )}

          {[...profile.notices.map((n) => n.actionId), ...(profile.current ? [profile.current.actionId] : [])].length > 0 && (
            <form className="form" onSubmit={onForm('/claim/replies', ['actionId', 'body'], 'Reply saved. It is shown unedited next to the rating.')}>
              <label>Action
                <select name="actionId">
                  {profile.notices.map((n) => <option key={n.actionId}>{n.actionId}</option>)}
                  {profile.current && <option>{profile.current.actionId}</option>}
                </select>
              </label>
              <label className="full">Your reply (10 to 2000 characters)
                <textarea name="body" required minLength={10} maxLength={2000} />
              </label>
              <div className="full"><button className="btn" disabled={busy}>Save reply</button></div>
            </form>
          )}

          {profile.current && !profile.current.appeal && (
            <form className="form" onSubmit={onForm('/claim/appeals', ['actionId', 'reason'], 'Appeal submitted. The committee will decide it.')}>
              <input type="hidden" name="actionId" value={profile.current.actionId} />
              <label className="full">Reason for appeal (20 to 4000 characters)
                <textarea name="reason" required minLength={20} maxLength={4000} />
              </label>
              <div className="full"><button className="btn" disabled={busy}>Submit appeal</button></div>
            </form>
          )}

          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </>
      )}
    </section>
  );
}
