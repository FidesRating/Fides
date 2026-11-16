# FIDES backend

Credibility ratings for crypto influencers: AAA–D with Outlook and Rating Watch, modelled on the letter scales
used by credit rating agencies. NestJS 11 + Prisma 6.19 (PostgreSQL) + BullMQ (Redis). NestJS is the only
business-logic layer; the Next.js frontend in the repository root only reads the public API.

FIDES ratings are opinions based on public data and a published methodology. They are not statements of fact,
not regulated credit ratings, and not investment advice.

## Run locally

```bash
docker compose -f docker-compose.dev.yml up -d   # local Postgres and Redis (development only)
cp .env.example .env                              # set DATABASE_URL and REDIS_URL if you changed the ports
npm install                                       # postinstall: prisma generate
npx prisma migrate deploy
npx prisma db seed                                # methodology v1.0, staff, fictional demo account (SEED_DEMO=true)
npm run start:dev                                 # http://localhost:3001/api/v1
npm test                                          # unit tests + end-to-end tests (database "fides_test")
```

The runtime uses Prisma Client without the Rust engine (`engineType = "client"` + `@prisma/adapter-pg`) on the
pooled `DATABASE_URL`. Migrations use `DIRECT_URL` when it is set. Migrations are a new baseline: always use a new
database, never a database from a previous product.

Never run migrations or the seed against a database the project owner has not named.

## Data model

- `Influencer` is the rated subject. It owns one or more `SocialAccount` rows (`platform` enum: `x`, `youtube`,
  `telegram`). The MVP only accepts X; other platforms are switched on in `ENABLED_PLATFORMS` (`src/admin/admin.ts`).
  `Influencer.handle` is the public URL slug.
- `Call` references the `SocialAccount` that posted it and records price provenance: `priceSource`,
  `priceSourceRef` and `enteredById`.
- `EvidenceSnapshot` records source URL, archive URL, sha256 content hash, capture time and the staff member who
  captured it. Public endpoints expose link, hash and capture time only, never the storage path.
- `AuditLog` records every non-GET staff request (actor, route, `:id`). No request bodies.
- Every table has row level security enabled with no policies (see the `evidence_check_and_rls` migration).

## Rating cycle

```
analyst:   POST /admin/influencers/:id/actions   → scorecard (draft)
           POST /admin/actions/:id/recompute      (after data fixes)
           POST /admin/actions/:id/submit         (rejected while evidence is pending)
committee: PUT  /committee/actions/:id/vote       (at least 3 non-conflicted votes, ±1 notch, never above a cap)
           POST /committee/actions/:id/finalize   (median → rating, mode → outlook, 48 hour notice)
           POST /committee/actions/:id/publish    (only after the notice period)
           PATCH /committee/actions/:id/watch     (Rating Watch with a public reason)
account:   /claim/* (profile claim, signed wallets, reply, 14 day appeal)
job:       daily surveillance → reviewDue when the 180 day review is due, the scorecard drifts by 1 notch, or a watch passes 90 days
```

## Scorecard (`src/rating/rating.engine.ts`)

| Pillar | Weight | Score 0–100 |
| --- | --- | --- |
| Call Accuracy | 35% | 100 × (0.6 × hit rate + 0.4 × clamp(median 30 day excess vs BTC + 0.5)) |
| Disclosure | 25% | 100 × disclosed promotions ÷ proven promotions (none proven = 100) |
| Wallet Alignment | 25% | 100 × (1 − dump rate); no verified wallet = 50 |
| Conduct | 15% | 100 − 150 × share of deleted calls − 20 × rugs not withdrawn |

Automatic rules: fewer than 20 measurable calls → NR · undisclosed paid promotion and a dump on the same call → D ·
rug within 12 months → at most CCC+ · no verified wallet → at most A. The committee cannot change them.

## Rules enforced in code

- An account below 10,000 followers cannot be added.
- Wallets only come from a public post by the account itself (`sourceUrl` required) or a signature. No "suspected" wallets.
- Promotion evidence is used and shown only after it is `confirmed`.
- A tip never changes a rating, and analysts never see who sent it.
- A rating cannot be published before the notice period ends.
- A takedown (admin) removes the account from every public endpoint (410 Gone), including related articles.
- Public APIs never contain committee votes, staff names, member login wallets or unconfirmed evidence.
- The holder gate has no default token mint or threshold. While `TOKEN_MINT` or `MEMBER_MIN_BALANCE` is unset, nobody counts as a holder.
- Production refuses to boot with missing `CORS_ORIGINS`, `NOTICE_HOURS` below 48, `SEED_DEMO=true` or a mock balance.

## Endpoints (prefix `/api/v1`)

| Method | Path | Access |
| --- | --- | --- |
| GET | /ratings · /ratings/:handle · /ratings/:handle/history · /ratings/:handle/calls | public (full call record for holders) |
| GET | /actions · /under-review · /stats · /scale · /methodology · /research · /badge/:handle.svg | public |
| POST | /auth/nonce · /auth/verify · /auth/logout · GET /me · /me/api-keys | Solana wallet session |
| POST/GET | /claim/start · /claim/verify · /claim/me · /claim/wallets/* · /claim/replies · /claim/appeals | session |
| POST/GET | /tips · /me/tips | holder |
| * | /admin/** | analyst (takedown: admin) |
| * | /committee/** | committee |
| POST/PATCH | /research | analyst / committee |

## Tests

`npm test` runs the rating engine unit tests, the production configuration tests and the end-to-end suite
(`test/e2e.test.ts`). The end-to-end suite creates and wipes a local database named `fides_test` and refuses to run
against any other name. It needs the Docker Postgres and Redis from `docker-compose.dev.yml`.
