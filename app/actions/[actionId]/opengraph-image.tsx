import { ImageResponse } from 'next/og';
import { getActionCard } from '@/lib/api';
import { ACTION_LABEL, OUTLOOK, formatDate, formatRating } from '@/lib/format';

export const alt = 'FIDES rating action';
export const size = { width: 1200, height: 675 };
export const contentType = 'image/png';

const COLORS = { up: '#2f6b4f', down: '#7c1522', neutral: '#4a4f57', ink: '#1f1a10', paper: '#f5f0e8' };

type Props = { params: Promise<{ actionId: string }> };

/** Share card (1200x675): handle, old and new rating, outlook, action type and date. Unknown or removed actions get a neutral card. */
export default async function Image({ params }: Props) {
  const { actionId } = await params;
  const res = await getActionCard(actionId);
  const card = res.state === 'ok' ? res.data : null;
  const accent = !card ? COLORS.neutral : card.type === 'upgrade' ? COLORS.up : card.type === 'downgrade' ? COLORS.down : COLORS.neutral;
  const outlook = card?.outlook ? OUTLOOK[card.outlook]?.label ?? card.outlook : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: COLORS.paper, color: COLORS.ink, padding: 64, border: `12px solid ${accent}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 30, letterSpacing: 4 }}>
          <span>FIDES</span>
          <span style={{ color: accent }}>{card ? ACTION_LABEL[card.type] ?? card.type.toUpperCase() : 'RATING ACTION'}</span>
        </div>
        {card ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 52 }}>@{card.handle}</div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 150, fontWeight: 700, color: accent }}>
              {card.previousRating ? <span style={{ display: 'flex', fontSize: 90, color: COLORS.neutral, marginRight: 36 }}>{formatRating(card.previousRating)} to</span> : null}
              <span style={{ display: 'flex' }}>{formatRating(card.rating)}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 36 }}>
              {outlook ? `Outlook ${outlook}  ·  ` : ''}{formatDate(card.publishedAt)}  ·  {card.actionId}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', fontSize: 64 }}>Credibility ratings for crypto influencers</div>
        )}
        <div style={{ display: 'flex', fontSize: 26, color: COLORS.neutral }}>fides · opinion, not advice</div>
      </div>
    ),
    size,
  );
}
