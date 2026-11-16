import { ScorecardInput } from './rating.engine';

/**
 * FICTIONAL @lunar_alpha data from the dev brief: 70 calls (60 measurable), hit rate 55%, median excess +8%,
 * 6 promosi terbukti (3 diungkap), 2 wallet, 20 call dipegang (4 dump), 3 call dihapus, 0 rug.
 * Expected result: 56 / 50 / 80 / 94 → 66 → BBB+.
 */
export function lunarAlphaFixture(now = new Date()) {
  const day = 86400_000;
  const excess = [...Array(27).fill(-0.1), ...Array(6).fill(0.08), ...Array(27).fill(0.2)];
  const calls = Array.from({ length: 70 }, (_, i) => {
    const measurable = i < 60;
    return {
      id: `c${i}`,
      postedAt: new Date(now.getTime() - (measurable ? 400 - i * 5 : 20 - i + 60) * day),
      direction: 'long' as const,
      tokenSymbol: `TKN${i}`,
      priceAtCall: 1,
      price30d: measurable ? 1 + excess.at(i)! : null,
      btcAtCall: 50000,
      btc30d: measurable ? 50000 : null,
      deleted: i >= 67, // 3 dihapus
      rugConfirmedAt: null as Date | null,
      retracted: false,
    };
  });
  const promotions = Array.from({ length: 6 }, (_, i) => ({ callId: `c${i}`, disclosed: i < 3 }));
  const walletChecks = Array.from({ length: 20 }, (_, i) => ({ callId: `c${10 + i}`, heldAtCall: true, soldPct7d: i < 4 ? 0.8 : 0.1 }));
  const input: ScorecardInput = { now, calls, promotions, walletChecks, verifiedWalletCount: 2 };
  return input;
}
