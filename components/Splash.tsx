import Image from 'next/image';

/**
 * Brand splash shown once per browser session on a full page load: the FIDES mark pulses, then the screen fades out.
 * It is plain HTML and CSS, so it is painted with the first frame (no flash of the page behind it) and needs no hydration.
 * The inline script marks the session as seen before first paint. It is skipped for visitors who prefer reduced motion.
 */
const MARK_SEEN = "try{if(sessionStorage.getItem('fides_splash'))document.documentElement.classList.add('no-splash');else sessionStorage.setItem('fides_splash','1')}catch(e){}";

export default function Splash() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: MARK_SEEN }} />
      <div className="splash" aria-hidden="true">
        <Image className="splash-logo" src="/fides-logo.png" alt="" width={112} height={108} priority />
      </div>
    </>
  );
}
