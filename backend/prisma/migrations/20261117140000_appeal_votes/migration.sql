-- Votes to reject an appeal (quorum rule). Additive only: a new table.
CREATE TABLE "AppealVote" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppealVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppealVote_appealId_staffId_key" ON "AppealVote"("appealId", "staffId");

ALTER TABLE "AppealVote" ADD CONSTRAINT "AppealVote_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "Appeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppealVote" ADD CONSTRAINT "AppealVote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security on, with no public policies (the API connects with a privileged role).
ALTER TABLE "AppealVote" ENABLE ROW LEVEL SECURITY;
