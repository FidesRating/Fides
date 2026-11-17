import Image from 'next/image';

/** Shown by Next.js while a page is loading: the FIDES mark, centered, with a slow pulse. */
export default function Loading() {
  return (
    <section className="loading-screen" role="status" aria-live="polite">
      <Image className="loading-logo" src="/fides-logo.png" alt="" width={96} height={93} priority />
      <span className="sr-only">Loading</span>
    </section>
  );
}
