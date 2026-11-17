-- Desk watchlist: a holder's saved accounts. Additive only: a new table.
CREATE TABLE "WatchlistItem" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchlistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WatchlistItem_memberId_influencerId_key" ON "WatchlistItem"("memberId", "influencerId");

ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WatchlistItem" ADD CONSTRAINT "WatchlistItem_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security on, with no public policies (the API connects with a privileged role).
ALTER TABLE "WatchlistItem" ENABLE ROW LEVEL SECURITY;
