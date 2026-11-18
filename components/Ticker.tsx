const ITEMS = [
  'INDEPENDENT CREDIBILITY RATINGS',
  'METHODOLOGY PUBLISHED IN FULL',
  'RATED BY A HUMAN COMMITTEE',
  'RATINGS YOU CANNOT BUY',
  'AAA TO D, WITH OUTLOOK',
];
const LINE = `${ITEMS.join('  ·  ')}  ·`;

// Only statements that are always true. No counts or "latest" claims: those would need live data.
export default function Ticker() {
  return (
    <div className="ticker" aria-label="Announcements">
      <div className="ticker-track">
        <span>{LINE}</span>
        <span aria-hidden="true">{LINE}</span>
      </div>
    </div>
  );
}
