'use client';

import { useState } from 'react';
import type { ApiResult } from '@/lib/session';

/** What every staff panel receives: one API caller that shows the outcome, and the busy flag. */
export interface Ctx {
  call(path: string, body?: unknown, method?: string, done?: string): Promise<ApiResult>;
  busy: boolean;
}

export const panel: React.CSSProperties = { padding: 22, display: 'grid', gap: 16 };
export const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' };

export const CHAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb', 'avalanche', 'berachain', 'solana', 'sui', 'aptos', 'ton'];

export const val = (form: HTMLFormElement, name: string) => String(new FormData(form).get(name) ?? '').trim();
export const optVal = (form: HTMLFormElement, name: string) => val(form, name) || undefined;
export const optNum = (form: HTMLFormElement, name: string) => {
  const v = val(form, name);
  return v === '' ? undefined : Number(v);
};
export const checked = (form: HTMLFormElement, name: string) => new FormData(form).get(name) === 'on';

export const stamp = (iso?: string | null) => (iso ? `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '-');
export const num = (v: unknown) => (v === null || v === undefined ? '-' : String(Number(v)));
export const shorten = (s: string, n = 34) => (s.length > n ? `${s.slice(0, n)}...` : s);

export const sha256File = async (file: File) => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
};

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div><h3>{title}</h3>{hint && <p>{hint}</p>}</div>
      {children}
    </div>
  );
}

/** Provenance record for a call or a promotion: source URL, content hash (typed, or computed from a file in the browser). */
export function SnapshotForm({ ctx, path, onDone }: { ctx: Ctx; path: string; onDone: () => void }) {
  const [hash, setHash] = useState('');
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        const r = await ctx.call(path, { sourceUrl: val(f, 'sourceUrl'), archiveUrl: optVal(f, 'archiveUrl'), contentHash: hash.trim(), storagePath: optVal(f, 'storagePath') }, 'POST', 'Evidence snapshot saved.');
        if (r.ok) { f.reset(); setHash(''); onDone(); }
      }}
    >
      <label className="full">Source URL<input name="sourceUrl" type="url" placeholder="https://x.com/..." required /></label>
      <label>Archive URL (optional)<input name="archiveUrl" type="url" placeholder="https://" /></label>
      <label>Storage path (optional)<input name="storagePath" maxLength={300} /></label>
      <label className="full">
        Content hash (sha256, 64 hex characters)
        <input value={hash} onChange={(e) => setHash(e.target.value)} pattern="[A-Fa-f0-9]{64}" required />
      </label>
      <label className="full">
        Or compute it from a file (the file never leaves this browser)
        <input type="file" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setHash(await sha256File(file)); }} />
      </label>
      <div className="full"><button className="btn" disabled={ctx.busy}>Save snapshot</button></div>
    </form>
  );
}
