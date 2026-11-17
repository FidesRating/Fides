'use client';

import { useState } from 'react';
import { apiCall, errorText } from '@/lib/session';

/** Public takedown request. The answer is the same for every handle, so the form never reveals who is rated. */
export default function TakedownForm() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    const r = await apiCall('/takedown-requests', null, {
      handle: String(data.get('handle') ?? '').trim().replace(/^@/, ''),
      reason: String(data.get('reason') ?? '').trim(),
      contact: String(data.get('contact') ?? '').trim() || undefined,
    });
    setBusy(false);
    setMessage(r.ok ? r.json.message : r.status === 429 ? 'Too many requests. Try again later.' : errorText(r));
    if (r.ok) form.reset();
  }

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>Account handle<input name="handle" placeholder="@handle" maxLength={16} required /></label>
      <label>How we can reach you (optional)<input name="contact" maxLength={200} /></label>
      <label className="full">Why the account does not meet the coverage rules (10 to 1000 characters)
        <textarea name="reason" required minLength={10} maxLength={1000} />
      </label>
      <div className="full"><button className="btn" disabled={busy}>Send request</button></div>
      {message && <p className="full note" role="status">{message}</p>}
    </form>
  );
}
