'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const API = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1`;
const TOKEN_KEY = 'fides_session';

interface PhantomProvider {
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, display: 'utf8'): Promise<{ signature: Uint8Array }>;
}

interface Notice { actionId: string; rating: string | null; publishAfter: string | null; message: string }
interface Current {
  actionId: string; rating: string | null; reply: string | null;
  appeal: { status: string } | null; appealDeadline: string | null;
}
interface Profile { handle: string; participating: boolean; notices: Notice[]; current: Current | null }

const readToken = () => {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const writeToken = (t: string | null) => {
  try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
};
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
const fmt = (iso: string | null) => (iso ? new Date(iso).toUTCString() : '');

export default function ClaimFlow() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // The code and state X sends back are kept until the wallet is signed in.
  const pending = useRef<{ code: string; state: string } | null>(null);

  const call = useCallback(async (path: string, tok: string | null, body?: unknown) => {
    const res = await fetch(`${API}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  }, []);

  const errorText = (r: { json: { message?: string | string[] } | null }) =>
    [r.json?.message ?? 'Something went wrong. Try again.'].flat().join(' ');

  const loadProfile = useCallback(async (tok: string) => {
    const r = await call('/claim/me', tok);
    if (r.status === 401) { writeToken(null); setToken(null); return; }
    setProfile(r.ok ? r.json : null);
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
    try {
      const phantom = (window as unknown as { solana?: PhantomProvider }).solana;
      if (!phantom) { setMessage('Install a Solana wallet such as Phantom to sign in.'); return; }
      const { publicKey } = await phantom.connect();
      const walletAddress = publicKey.toString();
      const n = await call('/auth/nonce', null, { walletAddress });
      if (!n.ok) { setMessage(errorText(n)); return; }
      const { signature } = await phantom.signMessage(new TextEncoder().encode(n.json.message), 'utf8');
      const v = await call('/auth/verify', null, { walletAddress, nonce: n.json.nonce, signature: toHex(signature) });
      if (!v.ok) { setMessage(errorText(v)); return; }
      writeToken(v.json.token);
      setToken(v.json.token);
      await loadProfile(v.json.token);
      await completeX(v.json.token);
    } catch {
      setMessage('Wallet request was cancelled.');
    } finally {
      setBusy(false);
    }
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

  function signOut() {
    writeToken(null);
    setToken(null);
    setProfile(null);
    setMessage('');
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

      {token && !profile && (
        <>
          <h2>2. Log in with X</h2>
          <p>X confirms which account you control. FIDES reads only your username.</p>
          <div className="btns">
            <button className="btn primary" disabled={busy} onClick={loginWithX}>Log in with X</button>
            <button className="btn" onClick={signOut}>Sign out</button>
          </div>
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
