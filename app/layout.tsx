import type { Metadata } from 'next';
import { Fraunces, IBM_Plex_Mono, Inter } from 'next/font/google';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Ticker from '@/components/Ticker';
import './globals.css';
import './polish.css';

const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], style: ['normal', 'italic'], variable: '--font-fraunces', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono', display: 'swap' });

const DESCRIPTION =
  'Independent AAA–D credibility ratings for crypto influencers, built from public calls, disclosures, and wallets they declared themselves.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: { default: 'FIDES — Credibility Ratings for Crypto Influencers', template: '%s — FIDES' },
  description: DESCRIPTION,
  openGraph: { title: 'FIDES: Rated Before You Trust', description: DESCRIPTION, siteName: 'FIDES', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'FIDES: Rated Before You Trust', description: DESCRIPTION },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${plexMono.variable}`}>
      <body>
        <Ticker />
        <div className="wrap">
          <Header />
          <main className="stack" id="main">
            {children}
            <Footer />
          </main>
        </div>
      </body>
    </html>
  );
}
