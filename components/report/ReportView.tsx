import Link from 'next/link';
import type { CallRow, Report } from '@/lib/api';
import { ACTION_CLASS, ACTION_LABEL, BAND_CLASS, BAND_LABEL, OUTLOOK, formatDate, formatRating, safeAvatarUrl, watchLabel } from '@/lib/format';

const pct = (n: number | null) =>
  n === null ? <span className="rl-dash">n/a</span> : <span className={n >= 0 ? 'pos' : 'neg'}>{`${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`}</span>;

const monthYear = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function pillarData(r: Report, key: string): string {
  const sc = r.rating.scorecard;
  if (key === 'accuracy') {
    const hit = sc.hitRate === null ? '' : `, hit rate ${Math.round(sc.hitRate * 100)}%`;
    const med = sc.medianExcess30d === null ? '' : `, median 30-day excess return ${sc.medianExcess30d >= 0 ? '+' : ''}${Math.round(sc.medianExcess30d * 100)}% vs BTC`;
    return `${sc.measurableCalls} measurable calls (of ${r.calls.total})${hit}${med}`;
  }
  if (key === 'disclosure') {
    const proven = r.evidence.paidPromotions.length;
    const disclosed = r.evidence.paidPromotions.filter((p) => p.disclosed).length;
    return proven ? `${proven} proven paid promotions, ${disclosed} disclosed` : 'No proven paid promotion';
  }
  if (key === 'walletAlignment') {
    const n = r.evidence.wallets.length;
    return n ? `${n} verified wallet${n > 1 ? 's' : ''}` : 'No verified wallet (scored 50)';
  }
  return 'Deleted calls and promoted projects later proven to be rugs';
}

function ProofCell({ c }: { c: CallRow }) {
  const snap = c.snapshots[0];
  const link = c.deleted ? c.archiveUrl : c.postUrl;
  return (
    <>
      {link ? <a className="mono" style={{ color: 'var(--brass)', fontSize: 12 }} href={link} target="_blank" rel="noopener noreferrer">{c.deleted ? 'archive ↗' : 'post ↗'}</a> : <span className="rl-dash">n/a</span>}
      {snap && <span className="note" title={`sha256 ${snap.contentHash}`} style={{ marginLeft: 8 }}>#{snap.contentHash.slice(0, 8)}</span>}
    </>
  );
}

export default function ReportView({ r }: { r: Report }) {
  const { account, rating, calls, evidence } = r;
  const band = rating.band ?? 'not_rated';
  const b = BAND_CLASS[band];
  const outlook = rating.outlook ? OUTLOOK[rating.outlook] : null;
  const pillars = rating.scorecard.pillars;
  const low = pillars ? Math.min(...pillars.map((p) => p.score)) : null;
  const weakest = pillars?.find((p) => p.score === low) ?? null;
  const caps = rating.scorecard.appliedCaps;
  const rated = rating.rating ?? 'NR';
  const avatar = safeAvatarUrl(account.avatarUrl);

  return (
    <div className="page-stack">
      <nav className="crumbs" aria-label="Breadcrumb" style={{ padding: '0 2px' }}>
        <Link href="/">Home</Link><span>/</span><Link href="/ratings">Ratings</Link><span>/</span><span>@{account.handle}</span>
      </nav>

      <section className="box">
        <div className="rep-head">
          <div className="rep-id">
            <div className="avatar" aria-hidden="true">
              {account.handle[0].toUpperCase()}
              {avatar && (
                // The letter stays underneath: if the picture does not load, the letter is what shows.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" width={72} height={72} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
              )}
            </div>
            <div>
              <span className="eyebrow">RATING REPORT</span>
              <h1 className="hd" style={{ fontFamily: 'var(--mono)', fontSize: 'clamp(22px,3vw,30px)', letterSpacing: 0, marginTop: 6 }}>@{account.handle}</h1>
              <div className="sub2">{account.followers.toLocaleString('en-US')} followers on X</div>
              <div className="rep-chips">
                <span className="tag">{account.coverage}</span>
                <span className={`tag ${b === 't' ? 'tr' : b === 'd' ? 'neg' : ''}`}>{BAND_LABEL[band]}</span>
                {outlook && <span className={`tag ${outlook.tone === 'neg' ? 'neg' : outlook.tone === 'pos' ? 'tr' : ''}`}>{outlook.arrow} Outlook {outlook.label}</span>}
                {rating.watch && <span className="rl-watch">{watchLabel(rating.watch).toUpperCase()}</span>}
                {account.underReview && <span className="tag">New action under review</span>}
              </div>
            </div>
          </div>
          <div className="rep-big in">
            <div className={`letter ${b}`} aria-label={`Rating ${formatRating(rated)}, ${BAND_LABEL[band]}`}>{formatRating(rated)}</div>
            <div className="side">
              <span>Scorecard <b>{rating.scorecard.totalScore ?? 'n/a'}{rating.scorecard.scorecardRating ? ` → ${formatRating(rating.scorecard.scorecardRating)}` : ''}</b></span>
              <span>Committee <b>{formatRating(rated)}</b></span>
              {caps.length > 0 && <span style={{ color: 'var(--brass)' }}>{caps.join(', ')}</span>}
            </div>
          </div>
        </div>
        <div className="rep-dates">
          <div><span>Last action</span>{ACTION_LABEL[rating.type] ?? rating.type} · {formatDate(rating.publishedAt)}</div>
          <div><span>Next full review</span>{monthYear(r.nextFullReview)}</div>
          <div><span>Methodology</span>Version {rating.methodologyVersion}</div>
          <div><span>Reply</span>{rating.reply ? 'Published' : account.coverage === 'Participating' ? 'None' : 'None yet (profile not claimed)'}</div>
        </div>
        {rating.watch && (
          <div className="watchbox"><b>{watchLabel(rating.watch).toUpperCase()}</b>{rating.watchReason} Resolved within 90 days.</div>
        )}
      </section>

      <section className="box split">
        <div className="panel">
          <span className="eyebrow">COMMITTEE SUMMARY</span>
          {rating.rationale
            ? <p className="rationale">“{rating.rationale}”</p>
            : <p>The committee rating matches the scorecard, so no separate rationale is published.</p>}
          {rating.scorecard.differsFromScorecard && <p className="note">The final rating differs from the scorecard. The committee&apos;s reason is published above.</p>}
          {pillars && (
            <p>
              Final rating <b>{formatRating(rated)}</b> ({BAND_LABEL[band].toLowerCase()}), scorecard total {rating.scorecard.totalScore ?? 'n/a'}.
              {weakest ? ` The weakest pillar is ${weakest.label} at ${weakest.score}.` : ''}
              {rating.outlookText ? ` ${rating.outlookText}` : ''}
            </p>
          )}
          <dl className="facts">
            <div><dt>Measurable calls</dt><dd>{rating.scorecard.measurableCalls} of {calls.total}</dd></div>
            <div><dt>Hit rate</dt><dd>{rating.scorecard.hitRate === null ? 'n/a' : `${Math.round(rating.scorecard.hitRate * 100)}%`}</dd></div>
            <div><dt>Median 30-day excess vs BTC</dt><dd>{pct(rating.scorecard.medianExcess30d)}</dd></div>
            <div><dt>Caps applied</dt><dd>{caps.length ? caps.join(', ') : 'None'}</dd></div>
            <div><dt>Published</dt><dd>{formatDate(rating.publishedAt)}</dd></div>
            <div><dt>Next full review</dt><dd>{monthYear(r.nextFullReview)}</dd></div>
          </dl>
        </div>
        <div className="panel">
          <span className="eyebrow">SCORECARD</span>
          {pillars ? (
            <>
              <div className="pbars">
                {pillars.map((p) => (
                  <div className="pb" key={p.key}>
                    <div className="top"><b>{p.label} <span>{Math.round(p.weight * 100)}%</span></b><span className="v">{p.score}</span></div>
                    <div className={`track2 ${p.score === low ? 'weak' : ''}`}><i style={{ ['--w' as string]: `${p.score}%` }} /></div>
                    <div className="data">{pillarData(r, p.key)}</div>
                  </div>
                ))}
              </div>
              <div className="sc-total">
                <div>TOTAL<b>{rating.scorecard.totalScore}</b></div>
                <div>SCORECARD<b>{formatRating(rating.scorecard.scorecardRating)}</b></div>
                <div>FINAL RATING<b>{formatRating(rated)}</b></div>
              </div>
              {caps.map((c) => <div className="capline" key={c}>{c} applies.</div>)}
            </>
          ) : (
            <div className="capline">Not Rated: fewer than 15 calls are old enough to measure.</div>
          )}
        </div>
      </section>

      <section className="box">
        <div className="secbar">
          <h3>Call record</h3>
          <span className="note">Latest {calls.shown} of {calls.total}{calls.fullAccess ? '' : ' · FIDES Desk holders see the full record'}</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl calls">
            <caption className="sr-only">Calls by @{account.handle}</caption>
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Token</th><th scope="col">Proof</th><th scope="col">7 days</th><th scope="col">30 days</th><th scope="col">90 days</th><th scope="col">vs BTC (30d)</th><th scope="col">Sponsored</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {calls.items.map((c) => (
                <tr key={`${c.token}-${c.postedAt}`}>
                  <td>{formatDate(c.postedAt)}</td>
                  <td className="mono">{c.token}</td>
                  <td><ProofCell c={c} /></td>
                  <td className="mono">{pct(c.return7d)}</td><td className="mono">{pct(c.return30d)}</td><td className="mono">{pct(c.return90d)}</td>
                  <td className="mono">{pct(c.excessVsBtc30d)}</td>
                  <td>{c.paidPromotion ? <span className={`flag ${c.paidPromotion === 'disclosed' ? 'ok' : 'bad'}`}>{c.paidPromotion}</span> : <span className="rl-dash">n/a</span>}</td>
                  <td>{c.deleted ? <span className="flag bad">deleted</span> : c.rugConfirmed ? <span className="flag bad">rug</span> : <span className="rl-dash">n/a</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rl-foot"><span>Returns are measured from the price when the call was posted. A dash means the call is not old enough yet. Prices are entered by analysts and recorded with their source.</span></div>
      </section>

      <section className="box split">
        <div>
          <div className="secbar"><h3>Proven paid promotions</h3><span className="note">{evidence.paidPromotions.length} proven · {evidence.paidPromotions.filter((p) => p.disclosed).length} disclosed</span></div>
          {evidence.paidPromotions.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Token</th><th scope="col">Source</th><th scope="col">Evidence</th><th scope="col">Disclosed</th></tr></thead>
                <tbody>
                  {evidence.paidPromotions.map((p) => (
                    <tr key={p.evidenceUrl}>
                      <td className="mono">{p.call?.token ?? 'n/a'}</td>
                      <td className="wrap">{p.source.replace(/_/g, ' ')}</td>
                      <td><a className="mono" style={{ color: 'var(--brass)', fontSize: 12 }} href={p.evidenceUrl} target="_blank" rel="noopener noreferrer">link ↗</a>{p.snapshots[0] && <span className="note" title={`sha256 ${p.snapshots[0].contentHash}`} style={{ marginLeft: 8 }}>#{p.snapshots[0].contentHash.slice(0, 8)}</span>}</td>
                      <td><span className={`flag ${p.disclosed ? 'ok' : 'bad'}`}>{p.disclosed ? 'yes' : 'no'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel">
              <p>No proven paid promotion.</p>
              <p className="note">A promotion counts only when it is proven by public evidence, by the project&apos;s own statement, or by an on-chain payment to a wallet the account declared itself. With none proven, Disclosure is scored 100.</p>
            </div>
          )}
        </div>
        <div>
          <div className="secbar"><h3>Verified wallets</h3><span className="note">{evidence.wallets.length} verified</span></div>
          {evidence.wallets.length ? (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th scope="col">Chain</th><th scope="col">Address</th><th scope="col">How verified</th></tr></thead>
                <tbody>
                  {evidence.wallets.map((w) => (
                    <tr key={`${w.chain}-${w.address}`}>
                      <td>{w.chainName}</td>
                      <td className="mono">{w.explorerUrl ? <a href={w.explorerUrl} target="_blank" rel="noopener noreferrer">{w.address.slice(0, 6)}…{w.address.slice(-4)}</a> : w.address}</td>
                      <td className="wrap">{w.method === 'signature' ? 'Signed by the account' : 'Disclosed in a public post'}{w.sourceUrl && <> · <a style={{ color: 'var(--brass)' }} href={w.sourceUrl} target="_blank" rel="noopener noreferrer">post ↗</a></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="panel">
              <p>No verified wallet. FIDES never guesses wallets. Wallet Alignment is scored at 50 and the rating cannot go above A.</p>
              {account.coverage === 'Unsolicited' && <Link className="btn" href="/claim" style={{ alignSelf: 'flex-start' }}>Is this your account? Claim it ↗</Link>}
            </div>
          )}
        </div>
      </section>

      <section className="box split w64">
        <div className="panel">
          <span className="eyebrow">ACCOUNT&apos;S REPLY · UNEDITED</span>
          {rating.reply
            ? <><div className="reply">{rating.reply.body}</div><span className="note">Posted by @{account.handle} through a claimed profile.</span></>
            : (
              <>
                <p>No reply yet.{account.coverage === 'Unsolicited' ? ' The account has not claimed its profile.' : ''}</p>
                <p className="note">A claimed account can reply during the notice period and after publication, and can appeal the rating once. A reply is shown here unedited, beside the rating.</p>
                {account.coverage === 'Unsolicited' && <Link className="btn" href="/claim" style={{ alignSelf: 'flex-start' }}>Is this your account? Claim it ↗</Link>}
              </>
            )}
        </div>
        <div className="panel">
          <span className="eyebrow">RATING HISTORY</span>
          <ul className="tl">
            {r.history.slice(0, 3).map((h) => (
              <li key={h.actionId} className={ACTION_CLASS[h.type] === 'aff' ? '' : ACTION_CLASS[h.type]}>
                <div className="d">{formatDate(h.publishedAt)}</div>
                <div className="t">{ACTION_LABEL[h.type] ?? h.type} · {h.previousRating && h.previousRating !== h.rating ? `${formatRating(h.previousRating)} → ` : ''}{formatRating(h.rating)}</div>
                <div className="x">{h.outlook ? `Outlook ${OUTLOOK[h.outlook]?.label ?? h.outlook}` : ''}</div>
              </li>
            ))}
          </ul>
          <Link className="btn" href={`/ratings/${account.handle}/history`} style={{ alignSelf: 'flex-start' }}>Full history ↗</Link>
        </div>
      </section>

      <section className="box panel">
        <span className="eyebrow">DISCLAIMER</span>
        <p>{r.disclaimer}</p>
        <div className="btns"><Link className="btn" href="/methodology">Methodology ↗</Link><Link className="btn" href="/ethics">Ethics ↗</Link></div>
      </section>
    </div>
  );
}
