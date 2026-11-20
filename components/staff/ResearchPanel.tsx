'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ctx, Hint, Section, Table, optNum, panel, row, stamp, val } from './shared';

const KINDS = [
  { value: 'downgrade_note', label: 'Downgrade note' },
  { value: 'study', label: 'Study' },
  { value: 'methodology_note', label: 'Methodology note' },
  { value: 'case_file', label: 'Case file' },
  { value: 'interview', label: 'Interview' },
] as const;

interface ArticleRow {
  id: string;
  slug: string;
  kind: string;
  title: string;
  standfirst: string;
  body: string;
  readMinutes: number | null;
  publishedAt: string | null;
  updatedAt: string;
  influencers: { handle: string }[];
}

const BODY_MAX = 20000;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const minutes = (body: string) => Math.max(1, Math.round(body.trim().split(/\s+/).filter(Boolean).length / 200));
const kindLabel = (k: string) => KINDS.find((x) => x.value === k)?.label ?? k;

/** Write, edit, publish and unpublish Research articles. The server validates everything; public pages only show published ones. */
export function ResearchPanel({ ctx }: { ctx: Ctx }) {
  const [rows, setRows] = useState<ArticleRow[]>([]);
  const [editing, setEditing] = useState<ArticleRow | null>(null);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [bodyLength, setBodyLength] = useState(0);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(async () => {
    const r = await ctx.call('/research/staff/list');
    if (r.ok) setRows(r.json);
  }, [ctx]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(null); setSlug(''); setSlugTouched(false); setBodyLength(0); setFormKey((k) => k + 1); };
  const startEdit = (a: ArticleRow) => { setEditing(a); setSlug(a.slug); setSlugTouched(true); setBodyLength(a.body.length); setFormKey((k) => k + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  async function save(form: HTMLFormElement, publish: boolean) {
    const body = val(form, 'body');
    const handles = val(form, 'handles').split(/[\s,]+/).map((h) => h.replace(/^@/, '')).filter(Boolean);
    const payload = {
      kind: val(form, 'kind'), title: val(form, 'title'), slug, standfirst: val(form, 'standfirst'), body,
      readMinutes: optNum(form, 'readMinutes') ?? minutes(body), handles, publish,
    };
    const done = publish ? 'Published. It is now visible on the Research page.' : 'Saved as a draft. It is not public.';
    const r = editing ? await ctx.call(`/research/${editing.id}`, payload, 'PATCH', done) : await ctx.call('/research', payload, 'POST', done);
    if (r.ok) { await load(); startNew(); }
  }

  const toggle = async (a: ArticleRow) => {
    const r = await ctx.call(`/research/${a.id}`, { publish: !a.publishedAt }, 'PATCH', a.publishedAt ? 'Unpublished. It is no longer public.' : 'Published.');
    if (r.ok) load();
  };

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="box" style={panel}>
        <div style={{ ...row, justifyContent: 'space-between' }}>
          <div>
            <span className="eyebrow chip">{editing ? 'EDITING' : 'NEW ARTICLE'}</span>
            <h2 style={{ marginTop: 8 }}>{editing ? editing.title : 'Write a research article'}</h2>
          </div>
          {editing && <button className="btn" onClick={startNew}>Cancel edit</button>}
        </div>
        <p>
          Plain text only. Use neutral wording: describe what the data shows, never call anyone a scammer, and never suggest token ownership affects a rating.
          Opinions about accounts must follow the published methodology. Nothing is public until you press Publish.
        </p>
        <form key={formKey} className="form" onSubmit={(e) => e.preventDefault()}>
          <label>Type
            <select name="kind" defaultValue={editing?.kind ?? 'methodology_note'} required>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label>Title
            <input
              name="title" maxLength={160} required defaultValue={editing?.title ?? ''} placeholder="Short and factual"
              onChange={(e) => { if (!slugTouched && !editing) setSlug(slugify(e.target.value)); }}
            />
          </label>
          <label className="full">Summary (standfirst)
            <input name="standfirst" maxLength={300} required defaultValue={editing?.standfirst ?? ''} placeholder="One or two sentences shown on the Research page" />
          </label>
          <label>Web address (slug)
            <input value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} pattern="[a-z0-9-]+" maxLength={80} required placeholder="my-article" />
            <Hint>Lowercase letters, numbers and dashes. Must be unique.</Hint>
          </label>
          <label>Read time in minutes
            <input name="readMinutes" type="number" min={1} step={1} defaultValue={editing?.readMinutes ?? ''} placeholder="Calculated if empty" />
          </label>
          <label className="full">Related accounts (optional)
            <input name="handles" defaultValue={editing?.influencers.map((i) => `@${i.handle}`).join(', ') ?? ''} placeholder="@handle1, @handle2" />
            <Hint>Accounts that are already tracked. If an account is removed, the article disappears from public pages too.</Hint>
          </label>
          <label className="full">Article text
            <textarea
              name="body" rows={14} maxLength={BODY_MAX} required defaultValue={editing?.body ?? ''}
              onChange={(e) => setBodyLength(e.target.value.length)} style={{ resize: 'vertical' }}
              placeholder="Write the article here. Plain text, no HTML."
            />
            <Hint>{bodyLength.toLocaleString('en-US')} of {BODY_MAX.toLocaleString('en-US')} characters</Hint>
          </label>
          <div className="full" style={row}>
            <button type="button" className="btn" disabled={ctx.busy} onClick={(e) => { const f = e.currentTarget.form!; if (f.reportValidity()) save(f, false); }}>Save as draft</button>
            <button type="button" className="btn primary" disabled={ctx.busy} onClick={(e) => { const f = e.currentTarget.form!; if (f.reportValidity()) save(f, true); }}>
              {editing?.publishedAt ? 'Save and keep published' : 'Publish'}
            </button>
          </div>
        </form>
      </div>

      <div className="box" style={panel}>
        <Section title={`Articles (${rows.length})`} hint="Newest changes first, latest 50. Drafts are only visible here. Published articles can be edited at any time.">
          {rows.length ? (
            <Table head={['Title', 'Type', 'Status', 'Updated', '']}>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="wrap">
                    <div style={{ fontFamily: 'inherit', fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{a.title}</div>
                    <small style={{ color: 'var(--ink-faint)' }}>/{a.slug}{a.influencers.length ? ` · ${a.influencers.map((i) => `@${i.handle}`).join(', ')}` : ''}</small>
                  </td>
                  <td style={{ fontSize: 13 }}>{kindLabel(a.kind)}</td>
                  <td style={{ fontSize: 13 }}>
                    <span className="chip" style={{ fontSize: 10.5 }}>{a.publishedAt ? 'PUBLISHED' : 'DRAFT'}</span>
                    {a.publishedAt && <div><small>{stamp(a.publishedAt)}</small></div>}
                  </td>
                  <td style={{ fontSize: 13 }}>{stamp(a.updatedAt)}</td>
                  <td>
                    <div style={{ ...row, gap: 8, flexWrap: 'nowrap' }}>
                      <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }} onClick={() => startEdit(a)}>Edit</button>
                      <button className="btn" style={{ padding: '6px 14px', fontSize: 13 }} disabled={ctx.busy} onClick={() => toggle(a)}>{a.publishedAt ? 'Unpublish' : 'Publish'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          ) : <p>No articles yet.</p>}
        </Section>
      </div>
    </div>
  );
}
