'use client';

export default function CarouselButtons({ targetId }: { targetId: string }) {
  const scroll = (dir: 1 | -1) => {
    const el = document.getElementById(targetId);
    el?.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  return (
    <div className="ctrls">
      <button type="button" onClick={() => scroll(-1)} aria-label="Previous actions">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4 6 9l5 5" /></svg>
      </button>
      <button type="button" onClick={() => scroll(1)} aria-label="Next actions">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m7 4 5 5-5 5" /></svg>
      </button>
    </div>
  );
}
