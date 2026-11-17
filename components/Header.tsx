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
    <NavLinks><a className="ic" href="https://x.com/FIDESRatings" target="_blank" rel="noopener" aria-label="X"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.8 3h3.2l-7 8 8.2 10h-6.4l-5-6.3L5 21H1.8l7.5-8.6L1.4 3h6.6l4.5 5.8zm-1.1 16.2h1.8L7.4 4.7H5.5z"/></svg></a>
<a className="ic" href="https://github.com/" target="_blank" rel="noopener" aria-label="GitHub"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5a10.5 10.5 0 0 0-3.3 20.5c.5.1.7-.2.7-.5v-1.8c-2.9.6-3.5-1.4-3.5-1.4-.5-1.2-1.2-1.5-1.2-1.5-.9-.7.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.5 1.1 3.1.9.1-.7.4-1.1.7-1.4-2.3-.3-4.8-1.2-4.8-5.2 0-1.1.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.8 0 0 .9-.3 2.9 1.1a10 10 0 0 1 5.2 0c2-1.4 2.9-1.1 2.9-1.1.6 1.4.2 2.5.1 2.8.7.7 1.1 1.7 1.1 2.8 0 4-2.5 4.9-4.8 5.2.4.3.7 1 .7 2v3c0 .3.2.6.7.5A10.5 10.5 0 0 0 12 1.5z"/></svg></a></NavLinks>
    <Link className="claim" href="/claim"><span className="txt">CLAIM YOUR PROFILE</span><span className="arrow-box"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9 9 3M4 3h5v5"/></svg></span></Link>
  </header>
    </>
  );
}
