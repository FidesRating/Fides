import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <>
    <footer className="box">
      <div className="fc">
        <Link className="brand" href="/" aria-label="FIDES home" style={{ padding: '0', border: '0' }}>
          <Image className="brand-logo" src="/fides-logo.png" alt="" width={36} height={35} />
          <span className="brand-name">FIDES<small>CREDIBILITY RATINGS</small></span>
        </Link>
        <p className="about">Independent credibility ratings for crypto influencers. Opinions built from public data and a published methodology.</p>
        <div className="socials">
          <a href="https://x.com/FIDESRatings" target="_blank" rel="noopener" aria-label="X"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.2l-7 8 8.2 10h-6.4l-5-6.3L5 21H1.8l7.5-8.6L1.4 3h6.6l4.5 5.8zm-1.1 16.2h1.8L7.4 4.7H5.5z"/></svg></a>
        </div>
      </div>
      <div className="fc"><h5>RATINGS</h5><Link href="/ratings?band=t">Trusted grade</Link><Link href="/ratings?band=s">Speculative grade</Link><Link href="/actions">Rating actions</Link><Link href="/under-review">Under review</Link></div>
      <div className="fc"><h5>RESEARCH</h5><Link href="/research">Downgrade notes</Link><Link href="/research">Studies</Link><Link href="/research">Case files</Link><Link href="/research">Interviews</Link></div>
      <div className="fc"><h5>ABOUT</h5><Link href="/methodology">Methodology</Link><Link href="/scale">Scale</Link><Link href="/ethics">Ethics</Link><Link href="/desk">FIDES Desk</Link><Link href="/claim">Claim your profile</Link></div>
      <div className="legal">
        <span>© 2026 FIDES · Public data · Committee rated · Right of reply · Not investment advice</span>
        <p>FIDES ratings are opinions based on public data and a published methodology. They are not statements of fact, not regulated credit ratings, and not investment advice.</p>
      </div>
    </footer>
    </>
  );
}
