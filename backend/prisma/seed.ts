/**
 * Seed FIDES.
 *  1. Methodology v1.0 (always)
 *  2. Placeholder staff rows (no login): analyst, 4 committee members, admin. Real staff sign in by wallet (STAFF_WALLETS).
 *  3. FICTIONAL demo data @lunar_alpha (BBB, Outlook Negative) only when SEED_DEMO=true and NODE_ENV is not production.
 *
 * Run: npx prisma db seed
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { METHODOLOGY_VERSION, PILLARS, RULES, SCALE, assertMethodology } from '../src/rating/methodology';
import { committeeOutlook, committeeRating, computeScorecard } from '../src/rating/rating.engine';
import { lunarAlphaFixture } from '../src/rating/demo-fixture';
import { sha256 } from '../src/common/crypto';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const STAFF = [
  { email: 'analyst@fides.local', name: 'Lead Analyst', role: 'analyst' },
  { email: 'committee-a@fides.local', name: 'Committee A', role: 'committee' },
  { email: 'committee-b@fides.local', name: 'Committee B', role: 'committee' },
  { email: 'committee-c@fides.local', name: 'Committee C', role: 'committee' },
  { email: 'committee-d@fides.local', name: 'Committee D', role: 'committee' },
  { email: 'admin@fides.local', name: 'Admin', role: 'admin' },
] as const;

async function seedMethodology() {
  assertMethodology();
  const data = {
    pillars: PILLARS as unknown as Prisma.InputJsonValue,
    scale: SCALE as unknown as Prisma.InputJsonValue,
    rules: RULES as unknown as Prisma.InputJsonValue,
    changelog: 'First published methodology: four-pillar scorecard, AAA–D scale with outlook and watch, default/cap/NR rules, committee within one notch, 48-hour notice, right of reply and appeal.',
    isCurrent: true,
  };
  await prisma.methodologyVersion.upsert({ where: { version: METHODOLOGY_VERSION }, create: { version: METHODOLOGY_VERSION, ...data }, update: data });
  await prisma.methodologyVersion.updateMany({ where: { version: { not: METHODOLOGY_VERSION } }, data: { isCurrent: false } });
  console.log(`✔ Methodology v${METHODOLOGY_VERSION}`);
}

async function seedStaff() {
  const ids: Record<string, string> = {};
  // Placeholder staff rows (no login) so the demo votes have authors. Real staff sign in by wallet (STAFF_WALLETS).
  for (const s of STAFF) {
    const u = await prisma.user.upsert({
      where: { email: s.email },
      create: { email: s.email, name: s.name, role: s.role, passwordHash: '!' },
      update: {},
    });
    ids[s.email] = u.id;
  }
  console.log('✔ Staff accounts');
  return ids;
}

async function seedDemo(staff: Record<string, string>) {
  if (await prisma.influencer.findUnique({ where: { handle: 'lunar_alpha' } })) {
    console.log('• Demo account already present, skipping');
    return;
  }
  const now = new Date();
  const fx = lunarAlphaFixture(now);
  const sc = computeScorecard(fx);
  if (sc.totalScore !== 66 || sc.scorecardRating !== 'BBB+') throw new Error(`Demo no longer matches the brief: ${JSON.stringify(sc)}`);

  const inf = await prisma.influencer.create({
    data: {
      handle: 'lunar_alpha', displayName: 'Lunar Alpha (demo)', status: 'rated',
      accounts: { create: { platform: 'x', handle: 'lunar_alpha', followers: 182_000 } },
    },
    include: { accounts: true },
  });
  const account = inf.accounts[0];
  const walletA = await prisma.wallet.create({
    data: { influencerId: inf.id, chainKey: 'solana', address: 'DemoLunarA1pha11111111111111111111111111111', method: 'self_disclosed_post', sourceUrl: 'https://x.com/lunar_alpha/status/1000000000000000001' },
  });
  await prisma.wallet.create({
    data: { influencerId: inf.id, chainKey: 'base', address: '0x5555555555555555555555555555555555555555', method: 'self_disclosed_post', sourceUrl: 'https://x.com/lunar_alpha/status/1000000000000000002' },
  });
  const idOf: Record<string, string> = {};
  for (const [i, c] of fx.calls.entries()) {
    const row = await prisma.call.create({
      data: {
        influencerId: inf.id, socialAccountId: account.id, postUrl: `https://x.com/lunar_alpha/status/20000000000000000${String(i).padStart(2, '0')}`,
        priceSource: 'demo', enteredById: staff['analyst@fides.local'],
        archiveUrl: c.deleted ? `https://archive.example/lunar_alpha/${i}` : null,
        postedAt: c.postedAt, tokenSymbol: `TKN${i}`, chainKey: 'solana', direction: c.direction,
        priceAtCall: new Prisma.Decimal(c.priceAtCall), price30d: c.price30d === null ? null : new Prisma.Decimal(c.price30d),
        btcAtCall: new Prisma.Decimal(c.btcAtCall), btc30d: c.btc30d === null ? null : new Prisma.Decimal(c.btc30d),
        deletedAt: c.deleted ? now : null,
      },
    });
    idOf[c.id] = row.id;
    if (c.deleted) {
      await prisma.evidenceSnapshot.create({
        data: {
          callId: row.id, sourceUrl: row.postUrl, archiveUrl: row.archiveUrl, contentHash: sha256(`demo-snapshot-${i}`),
          capturedAt: now, capturedById: staff['analyst@fides.local'],
        },
      });
    }
  }
  for (const p of fx.promotions) {
    await prisma.promotion.create({
      data: {
        influencerId: inf.id, callId: idOf[p.callId!], source: 'project_disclosure', evidenceUrl: `https://example.com/demo-disclosure/${p.callId}`,
        disclosed: p.disclosed, status: 'confirmed', reviewedById: staff['analyst@fides.local'], reviewedAt: now,
      },
    });
  }
  for (const w of fx.walletChecks) {
    await prisma.callWalletCheck.create({ data: { callId: idOf[w.callId], walletId: walletA.id, heldAtCall: w.heldAtCall, soldPct7d: w.soldPct7d } });
  }

  const votes = [
    { email: 'committee-a@fides.local', rating: 'BBB', outlook: 'negative' as const },
    { email: 'committee-b@fides.local', rating: 'BBB', outlook: 'negative' as const },
    { email: 'committee-c@fides.local', rating: 'BBB+', outlook: 'stable' as const },
  ];
  const rating = committeeRating(votes.map((v) => v.rating));
  const outlook = committeeOutlook(votes.map((v) => v.outlook));
  await prisma.ratingAction.create({
    data: {
      actionNumber: 1, influencerId: inf.id, methodologyVersion: METHODOLOGY_VERSION, status: 'published', type: 'new',
      accuracy: sc.pillars!.accuracy, disclosure: sc.pillars!.disclosure, walletAlignment: sc.pillars!.walletAlignment, conduct: sc.pillars!.conduct,
      totalScore: sc.totalScore, indicatedRating: sc.indicatedRating, scorecardRating: sc.scorecardRating, appliedCaps: sc.appliedCaps,
      measurableCalls: sc.measurableCalls, inputs: sc.inputs as unknown as Prisma.InputJsonValue, suggestedOutlook: 'stable',
      rating, outlook,
      rationale: 'Three of six proven paid promotions were not disclosed, all within the last six months. The trend in disclosure weighs more than the strong conduct record.',
      noticeChannel: 'x_mention', noticeSentAt: new Date(now.getTime() - 3 * 86400_000), publishAfter: new Date(now.getTime() - 86400_000),
      finalizedAt: new Date(now.getTime() - 3 * 86400_000), publishedAt: now, analystId: staff['analyst@fides.local'],
      votes: { create: votes.map((v) => ({ staffId: staff[v.email], rating: v.rating, outlook: v.outlook })) },
    },
  });
  await prisma.article.create({
    data: {
      slug: 'lunar-alpha-new-rating', kind: 'downgrade_note', title: 'Why a strong caller lands at BBB',
      standfirst: 'Demo note for development. Replace before launch.', body: 'Demo article.', readMinutes: 4,
      authorId: staff['analyst@fides.local'], publishedAt: now, influencers: { connect: [{ handle: 'lunar_alpha' }] },
    },
  });
  console.log(`✔ Demo data (fictional): @lunar_alpha ${rating}, Outlook ${outlook} (scorecard ${sc.scorecardRating}, score ${sc.totalScore})`);
}

async function main() {
  await seedMethodology();
  const staff = await seedStaff();
  if (process.env.SEED_DEMO === 'true' && process.env.NODE_ENV !== 'production') await seedDemo(staff);
  else console.log('• Demo data skipped (SEED_DEMO is not true, or NODE_ENV is production)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
