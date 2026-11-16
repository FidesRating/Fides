import type { RatingListItem } from '@/lib/api';
import RatingsTable from '@/components/RatingsTable';

export default function RatingsPreview({ ratings }: { ratings: RatingListItem[] }) {
  return (
    <>
    <section className="box" aria-labelledby="h-list">
      <div className="act-head">
        <div className="l">
          <span className="idx">03.2 / RATINGS</span>
          <h2 id="h-list">Latest changes on <em>the scale.</em></h2>
          
        </div>
      </div>
      <RatingsTable items={ratings.slice(0, 6)} />
    </section>
    </>
  );
}
