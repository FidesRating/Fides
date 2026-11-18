import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'FIDES: credibility ratings for crypto influencers';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const COLORS = { burgundy: '#7c1522', ink: '#1f1a10', muted: '#4a4f57', paper: '#f5f0e8' };

/** Default share card (1200x630) for the site: the FIDES mark, the promise, and the AAA to D scale. */
export default async function Image() {
  const logo = await readFile(path.join(process.cwd(), 'public', 'fides-logo.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: COLORS.paper, color: COLORS.ink, padding: '56px 72px', borderTop: `14px solid ${COLORS.burgundy}` }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={64} height={64} alt="" style={{ objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 22 }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>FIDES</span>
            <span style={{ fontSize: 18, letterSpacing: 5, color: COLORS.muted }}>CREDIBILITY RATINGS</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 98, fontWeight: 700, lineHeight: 1.05 }}>
            <span>Rated before</span>
          </div>
          <div style={{ display: 'flex', fontSize: 98, fontWeight: 700, lineHeight: 1.05, color: COLORS.burgundy }}>
            <span>you trust.</span>
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: COLORS.muted, marginTop: 24 }}>
            Independent credibility ratings for crypto influencers.
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700 }}>
            <span style={{ display: 'flex', color: '#2f6b4f' }}>AAA</span>
            <span style={{ display: 'flex', color: COLORS.muted, margin: '0 16px', fontWeight: 400 }}>to</span>
            <span style={{ display: 'flex', color: COLORS.burgundy }}>D</span>
          </div>
          <span style={{ display: 'flex', fontSize: 22, color: COLORS.muted }}>Opinion, not advice</span>
        </div>
      </div>
    ),
    size,
  );
}
