'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiCall, errorText, readToken, signInWithWallet, signOutSession, writeToken } from '@/lib/session';
import { useWalletGuard } from '@/lib/walletGuard';

interface Me { walletAddress: string; tokenBalance: number; minBalance: number | null; isHolder: boolean }
interface WatchItem { handle: string; displayName: string | null; current: { rating: string | null; outlook: string | null; watch: string | null } | null }
interface FeedItem { actionId: string; handle: string; type: string; rating: string | null; previousRating: string | null; publishedAt: string }
interface KeyRow { id: string; label: string; prefix: string; createdAt: string }
interface TipRow { kind: string; evidenceUrl: string; status: string; influencer: { handle: string } }

const TIP_KINDS = ['paid_promotion', 'deleted_post', 'wallet_sale', 'rug', 'other'];
const fmt = (iso: string) => new Date(iso).toUTCString();

export default function DeskFlow() {
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [tips, setTips] = useState<TipRow[]>([]);
  const [newKey, setNewKey] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (tok: string) => {
    const m = await apiCall('/me', tok);
    if (m.status === 401) { writeToken(null); setToken(null); setMe(null); return; }
    if (!m.ok) { setMessage(errorText(m)); return; }
    setMe(m.json);
    if (!m.json.isHolder) return;
    const [w, f, k, t] = await Promise.all([
      apiCall('/me/watchlist', tok), apiCall('/me/watchlist/feed', tok), apiCall('/me/api-keys', tok), apiCall('/me/tips', tok),
    ]);
    if (w.ok) setWatch(w.json);
    if (f.ok) setFeed(f.json);
    if (k.ok) setKeys(k.json);
    if (t.ok) setTips(t.json);
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
    setNewKey('');
    setMessage('');
    await signOutSession(tok);
  }

  useWalletGuard(!!token, () => { signOut(); setMessage('Your wallet changed, so you were signed out. Sign in again.'); });

  /** Runs one API call, shows the outcome, and refreshes the lists. */
  async function act(path: string, body: unknown, method: string | undefined, done: string) {
    if (!token) return null;
    setBusy(true);
    const r = await apiCall(path, token, body, method);
    setBusy(false);
    setMessage(r.ok ? done : errorText(r));
    if (r.ok) await load(token);
    return r;
  }

  const field = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? '').trim();

  return (
    <section className="box" style={{ padding: 24, display: 'grid', gap: 22 }}>
      {message && <p role="status">{message}</p>}

      {!token && (
        <>
          <h2>Sign in with a wallet</h2>
          <p>A signature only. No transaction, no fee.</p>
          <div className="btns"><button className="btn primary" disabled={busy} onClick={signIn}>{busy ? "Waiting for your wallet..." : "Connect wallet"}</button></div>
        </>
      )}

      {token && me && !me.isHolder && (
        <>
          <h2>The Desk is for token holders</h2>
          <p>
            {me.minBalance === null
              ? 'The Desk opens when the token launches.'
              : `Your wallet is signed in, but its balance is below the minimum of ${me.minBalance}.`}
          </p>
          <p>Holding the token opens the full data and the Desk. It never changes a rating.</p>
          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </>
      )}

      {token && me?.isHolder && (
        <>
          <div>
            <h2>Watchlist</h2>
            <p>Save accounts to see their published rating actions here. Nothing is sent to you, and nothing appears before publication.</p>
            <form className="form" onSubmit={(e) => { e.preventDefault(); const h = field(e.currentTarget, 'handle'); if (h) act(`/me/watchlist/${encodeURIComponent(h.replace(/^@/, ''))}`, undefined, 'PUT', 'Saved to your watchlist.'); e.currentTarget.reset(); }}>
              <label className="full">Account handle<input name="handle" placeholder="@handle" maxLength={16} required /></label>
              <div className="full"><button className="btn" disabled={busy}>Save account</button></div>
            </form>
            {watch.length > 0 && (
              <ul className="list-dot">
                {watch.map((w) => (
                  <li key={w.handle}>
                    <span>
                      <a href={`/ratings/${w.handle}`}>@{w.handle}</a>
                      {w.current ? `: ${w.current.rating ?? ''}${w.current.outlook ? `, outlook ${w.current.outlook}` : ''}${w.current.watch ? `, ${w.current.watch.replace('watch_', 'Rating Watch ')}` : ''}` : ': no published rating yet'}
                      {' '}<button className="btn" disabled={busy} onClick={() => act(`/me/watchlist/${encodeURIComponent(w.handle)}`, undefined, 'DELETE', 'Removed from your watchlist.')}>Remove</button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3>Latest rating actions on your watchlist</h3>
            {feed.length ? (
              <ul className="list-dot">
                {feed.map((a) => (
                  <li key={a.actionId}><span><a href={`/actions/${a.actionId}`}>{a.actionId}</a> @{a.handle}: {a.type}, {a.previousRating ? `${a.previousRating} to ` : ''}{a.rating} ({fmt(a.publishedAt)})</span></li>
                ))}
              </ul>
            ) : <p>No published actions yet for the accounts you watch.</p>}
          </div>

          <div>
            <h2>Send a tip</h2>
            <p>Tips are evidence, not votes. Analysts check them, and they never change a rating directly. Analysts do not see who sent a tip.</p>
            <form className="form" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; act('/tips', { handle: field(f, 'handle').replace(/^@/, ''), kind: field(f, 'kind'), evidenceUrl: field(f, 'evidenceUrl'), note: field(f, 'note') || undefined }, undefined, 'Tip sent. An analyst will review the evidence.').then((r) => { if (r?.ok) f.reset(); }); }}>
              <label>Account handle<input name="handle" placeholder="@handle" maxLength={16} required /></label>
              <label>What it shows<select name="kind">{TIP_KINDS.map((k) => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}</select></label>
              <label className="full">Link to public evidence<input name="evidenceUrl" type="url" placeholder="https://" required /></label>
              <label className="full">Note (optional)<textarea name="note" maxLength={1000} /></label>
              <div className="full"><button className="btn" disabled={busy}>Send tip</button></div>
            </form>
            {tips.length > 0 && <p>Your tips: {tips.map((t) => `@${t.influencer.handle} (${t.status})`).join(', ')}</p>}
          </div>

          <div>
            <h2>API keys</h2>
            <p>A key opens the full call record from the public API. Send it in the <code>x-api-key</code> header.</p>
            {newKey && <p role="alert">Copy your new key now. It is shown only once: <code>{newKey}</code></p>}
            <form className="form" onSubmit={(e) => { e.preventDefault(); const f = e.currentTarget; act('/me/api-keys', { label: field(f, 'label') }, undefined, 'Key created.').then((r) => { if (r?.ok) { setNewKey(r.json.key); f.reset(); } }); }}>
              <label className="full">Label<input name="label" maxLength={40} required /></label>
              <div className="full"><button className="btn" disabled={busy}>Create key</button></div>
            </form>
            {keys.length > 0 && (
              <ul className="list-dot">
                {keys.map((k) => (
                  <li key={k.id}><span>{k.label} ({k.prefix}...) <button className="btn" disabled={busy} onClick={() => act(`/me/api-keys/${k.id}`, undefined, 'DELETE', 'Key revoked.')}>Revoke</button></span></li>
                ))}
              </ul>
            )}
          </div>

          <div className="btns"><button className="btn" onClick={signOut}>Sign out</button></div>
        </>
      )}
    </section>
  );
}
