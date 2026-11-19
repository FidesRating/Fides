import Image from 'next/image';
import Link from 'next/link';
import NavLinks from './NavLinks';

export default function Header() {
  return (
    <>
  <header className="top box">
    <Link className="brand" href="/" aria-label="FIDES home">
      <Image className="brand-logo" src="/fides-logo.png" alt="" width={40} height={39} priority />
      <span className="brand-name">FIDES<small>CREDIBILITY RATINGS</small></span>
    </Link>
    <NavLinks><a className="ic" href="https://x.com/FIDESRatings" target="_blank" rel="noopener" aria-label="X"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.2l-7 8 8.2 10h-6.4l-5-6.3L5 21H1.8l7.5-8.6L1.4 3h6.6l4.5 5.8zm-1.1 16.2h1.8L7.4 4.7H5.5z"/></svg></a></NavLinks>
    <Link className="claim" href="/claim" aria-label="Claim your profile"><span className="txt">CLAIM YOUR PROFILE</span><span className="txt-short">CLAIM</span><span className="arrow-box"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9 9 3M4 3h5v5"/></svg></span></Link>
  </header>
    </>
  );
}
