-- Public takedown request intake. Additive only: a new enum and table.
CREATE TYPE "TakedownStatus" AS ENUM ('new', 'accepted', 'rejected');

CREATE TABLE "TakedownRequest" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "contact" TEXT,
    "status" "TakedownStatus" NOT NULL DEFAULT 'new',
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "TakedownRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TakedownRequest_status_createdAt_idx" ON "TakedownRequest"("status", "createdAt");

-- Row Level Security on, with no public policies (the API connects with a privileged role).
ALTER TABLE "TakedownRequest" ENABLE ROW LEVEL SECURITY;
