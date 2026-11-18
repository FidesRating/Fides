import { ImageResponse } from 'next/og';
import { getReport } from '@/lib/api';
import { BAND_LABEL, OUTLOOK, formatRating } from '@/lib/format';

export const alt = 'FIDES rating report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const COLORS = { burgundy: '#7c1522', ink: '#1f1a10', muted: '#4a4f57', paper: '#f5f0e8', green: '#2f6b4f' };

/** Share card for one rating report. It uses only public report fields. Without a published report it shows a neutral card. */
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const res = await getReport(handle);
  const ok = res.state === 'ok';
  const rating = ok ? res.data.rating : null;
  const outlook = rating?.outlook ? OUTLOOK[rating.outlook]?.label : null;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: COLORS.paper, color: COLORS.ink, padding: '56px 72px', borderTop: `14px solid ${COLORS.burgundy}` }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ display: 'flex', fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>FIDES</span>
          <span style={{ display: 'flex', fontSize: 18, letterSpacing: 5, color: COLORS.muted }}>CREDIBILITY RATINGS</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>{ok ? `@${res.data.account.handle}` : 'Rating report'}</span>
            {ok && <span style={{ display: 'flex', fontSize: 30, color: COLORS.muted, marginTop: 12 }}>{res.data.account.followers.toLocaleString('en-US')} followers</span>}
            {rating && (
              <span style={{ display: 'flex', fontSize: 32, marginTop: 22, color: rating.band === 'trusted' ? COLORS.green : COLORS.burgundy }}>
                {rating.band ? BAND_LABEL[rating.band] : ''}{outlook ? `  ·  Outlook ${outlook}` : ''}
              </span>
            )}
          </div>
          {rating && <span style={{ display: 'flex', fontSize: 190, fontWeight: 700, color: COLORS.burgundy, lineHeight: 1 }}>{formatRating(rating.rating)}</span>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', fontSize: 24, color: COLORS.muted }}>Committee rated, from public data</span>
          <span style={{ display: 'flex', fontSize: 24, color: COLORS.muted }}>Opinion, not advice</span>
        </div>
      </div>
    ),
    size,
  );
}
