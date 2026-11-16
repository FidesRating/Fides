import type { RatingAction } from '@/lib/api';
import ActionsTrack from '@/components/ActionsTrack';
import CarouselButtons from '@/components/CarouselButtons';

export default function ActionsSection({ actions }: { actions: RatingAction[] }) {
  return (
    <>
    <section className="box" id="actions" aria-labelledby="h-actions">
      <div className="act-head">
        <div className="l">
          <span className="idx">03.1 / RATING ACTIONS</span>
          <h2 id="h-actions">Upgrades, downgrades, <em>affirmations.</em></h2>
          
        </div>
        <CarouselButtons targetId="actionsTrack" />
</div>
<ActionsTrack actions={actions} />
    </section>
    </>
  );
}
