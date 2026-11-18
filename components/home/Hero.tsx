import Link from 'next/link';
import type { RatingListItem, Stats } from '@/lib/api';
import { BAND_LABEL, OUTLOOK, formatRating } from '@/lib/format';
import HeroScale from '@/components/HeroScale';

export default function Hero({ stats, latest }: { stats: Stats; latest: RatingListItem | null }) {
  const outlook = latest?.outlook ? OUTLOOK[latest.outlook] : null;
  return (
    <>
    <section className="hero box" aria-labelledby="h-hero">
      <div className="hero-copy">
        <span className="eyebrow chip">CREDIBILITY RATINGS FOR CRYPTO INFLUENCERS</span>
        <h1 id="h-hero">Every call has a <em>credit history</em><span className="cur" aria-hidden="true"></span></h1>
        <p className="sub">We rate crypto influencers the way agencies rate debt: from public calls, disclosed promotions, and the wallets they declared themselves. AAA to D, with an outlook.</p>
        <div className="btns">
          <Link className="btn primary" href="/ratings">See the Ratings <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 12 12 4M5.5 4H12v6.5"/></svg></Link>
          <Link className="btn" href="/methodology">Read the Methodology <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 2.5h7l3 3v8H3zM10 2.5v3h3M5.5 8.5h5M5.5 11h5"/></svg></Link>
        </div>
        <div className="stats" role="list">
          <div className="stat" role="listitem"><b className="num" >{stats.accountsRated.toLocaleString("en-US")}</b><span>Accounts rated</span></div>
          <div className="stat" role="listitem"><b className="num" >{stats.callsTracked.toLocaleString("en-US")}</b><span>Calls tracked</span></div>
          <div className="stat" role="listitem"><b className="num" >{stats.ratingActions.toLocaleString("en-US")}</b><span>Rating actions</span></div>
          <div className="stat" role="listitem"><b className="num" >{stats.aaaRatings.toLocaleString("en-US")}</b><span>AAA ratings</span></div>
        </div>
      </div>
      <div className="stage" id="stage">
        <HeroScale />
        <div className="dots" style={{ left: '30px', top: '30px' }}></div>
        <div className="dots" style={{ right: '70px', bottom: '120px', width: '60px', height: '48px' }}></div>
        <span className="plus" style={{ left: '44%', top: '22px' }}>+</span>
        <span className="plus" style={{ right: '26px', bottom: '24px' }}>+</span>
        <div className="vert">PUBLIC DATA · COMMITTEE RATED · RIGHT OF REPLY</div>
        <div className="glass g-tag">
          <i className="s1"></i><i className="s2"></i>
          <div className="k">THE SCALE · VERSION I</div>
          <div className="v">AAA → D<br/>with Outlook</div>
          <div className="barcode"></div>
        </div>
        {latest ? (
          <Link className="glass g-report" href={`/ratings/${latest.handle}`}>
            <i className="s1"></i><i className="s2"></i>
            <span className="g-sample">LATEST PUBLISHED RATING</span>
            <div className="row">
              <div>
                <div className="h">Rating Report</div>
                <div className="handle">@{latest.handle}</div>
                <div className="h" style={{ marginTop: '6px', textTransform: 'none', letterSpacing: '.02em' }}>{latest.followers.toLocaleString('en-US')} followers</div>
              </div>
              <div className="rbadge" aria-label={`Rating ${formatRating(latest.rating)}`}>{formatRating(latest.rating)}</div>
            </div>
            <div className="meta">
              <span className="tag tr">{BAND_LABEL[latest.band]}</span>
              {outlook && <span className={`tag${outlook.tone === 'neg' ? ' neg' : ''}`}>{outlook.arrow} Outlook {outlook.label}</span>}
            </div>
          </Link>
        ) : (
        <div className="glass g-report">
          <i className="s1"></i><i className="s2"></i>
          <span className="g-sample">SAMPLE REPORT · FICTIONAL ACCOUNT</span>
          <div className="row">
            <div>
              <div className="h">Rating Report</div>
              <div className="handle">@lunar_alpha</div>
              <div className="h" style={{ marginTop: '6px', textTransform: 'none', letterSpacing: '.02em' }}>182,000 followers</div>
            </div>
            <div className="rbadge" aria-label="Rating BBB, Trusted grade">BBB</div>
          </div>
          <div className="meta">
            <span className="tag tr">Trusted grade</span>
            <span className="tag neg">↓ Outlook Negative</span>
            <span className="tag">Unsolicited</span>
          </div>
        </div>
        )}
      </div>
      <div className="chainstrip">
        <span className="lbl">CALLS TRACKED ACROSS</span>
        <ul>
          <li><i></i>Ethereum</li><li><i></i>Solana</li><li><i></i>Base</li><li><i></i>Arbitrum</li><li><i></i>BNB Chain</li><li><i></i>Robinhood Chain</li>
        </ul>
      </div>
    </section>
    </>
  );
}
