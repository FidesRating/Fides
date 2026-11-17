-- Self-application intake: an account owner (proved by Login with X) asks to be covered; staff audit and decide.
-- Additive only: a new enum and table. No contact details are stored.
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'submitted', 'accepted', 'rejected');

CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "followers" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "evidenceUrls" TEXT[],
    "consentAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");
CREATE INDEX "Application_memberId_idx" ON "Application"("memberId");
CREATE INDEX "Application_handle_idx" ON "Application"("handle");

ALTER TABLE "Application" ADD CONSTRAINT "Application_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security on, with no public policies (the API connects with a privileged role).
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
