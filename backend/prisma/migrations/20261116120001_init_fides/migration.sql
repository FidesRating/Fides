-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('analyst', 'committee', 'admin');

-- CreateEnum
CREATE TYPE "InfluencerStatus" AS ENUM ('tracked', 'under_review', 'rated', 'not_rated', 'removed');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('x', 'youtube', 'telegram');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('long', 'short');

-- CreateEnum
CREATE TYPE "WalletMethod" AS ENUM ('self_disclosed_post', 'signature');

-- CreateEnum
CREATE TYPE "PromotionSource" AS ENUM ('project_disclosure', 'public_admission', 'onchain_payment', 'invoice', 'tip');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('new', 'upgrade', 'downgrade', 'affirm', 'withdraw');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('draft', 'committee', 'notice', 'published', 'superseded', 'cancelled');

-- CreateEnum
CREATE TYPE "Outlook" AS ENUM ('positive', 'stable', 'negative', 'developing');

-- CreateEnum
CREATE TYPE "Watch" AS ENUM ('watch_positive', 'watch_negative', 'watch_evolving');

-- CreateEnum
CREATE TYPE "NoticeChannel" AS ENUM ('profile', 'x_mention');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('open', 'upheld', 'reopened', 'rejected');

-- CreateEnum
CREATE TYPE "TipKind" AS ENUM ('paid_promotion', 'deleted_post', 'wallet_sale', 'rug', 'other');

-- CreateEnum
CREATE TYPE "TipStatus" AS ENUM ('new', 'accepted', 'rejected', 'duplicate');

-- CreateEnum
CREATE TYPE "ArticleKind" AS ENUM ('downgrade_note', 'study', 'methodology_note', 'case_file', 'interview');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "apiKeyHash" TEXT,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'analyst',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "action" TEXT NOT NULL,
    "entityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Influencer" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "status" "InfluencerStatus" NOT NULL DEFAULT 'tracked',
    "participating" BOOLEAN NOT NULL DEFAULT false,
    "reviewDue" BOOLEAN NOT NULL DEFAULT false,
    "reviewDueReason" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Influencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAccount" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'x',
    "handle" TEXT NOT NULL,
    "externalId" TEXT,
    "followers" INTEGER NOT NULL,
    "claimedById" TEXT,
    "claimedAt" TIMESTAMP(3),
    "claimCode" TEXT,
    "claimMemberId" TEXT,
    "claimCodeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "chainKey" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "method" "WalletMethod" NOT NULL,
    "sourceUrl" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "postUrl" TEXT NOT NULL,
    "archiveUrl" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "chainKey" TEXT,
    "tokenAddress" TEXT,
    "direction" "CallDirection" NOT NULL DEFAULT 'long',
    "sponsoredDisclosed" BOOLEAN NOT NULL DEFAULT false,
    "priceAtCall" DECIMAL(38,18) NOT NULL,
    "price7d" DECIMAL(38,18),
    "price30d" DECIMAL(38,18),
    "price90d" DECIMAL(38,18),
    "btcAtCall" DECIMAL(20,2) NOT NULL,
    "btc7d" DECIMAL(20,2),
    "btc30d" DECIMAL(20,2),
    "btc90d" DECIMAL(20,2),
    "deletedAt" TIMESTAMP(3),
    "projectRugConfirmedAt" TIMESTAMP(3),
    "retractedAt" TIMESTAMP(3),
    "priceSource" TEXT NOT NULL DEFAULT 'manual',
    "priceSourceRef" TEXT,
    "enteredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallWalletCheck" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "heldAtCall" BOOLEAN NOT NULL,
    "soldPct7d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "txHashes" TEXT[],
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallWalletCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "callId" TEXT,
    "source" "PromotionSource" NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "disclosed" BOOLEAN NOT NULL,
    "amountUsd" DECIMAL(20,2),
    "status" "EvidenceStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceSnapshot" (
    "id" TEXT NOT NULL,
    "callId" TEXT,
    "promotionId" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "archiveUrl" TEXT,
    "contentHash" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "capturedById" TEXT NOT NULL,
    "storagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MethodologyVersion" (
    "version" TEXT NOT NULL,
    "pillars" JSONB NOT NULL,
    "scale" JSONB NOT NULL,
    "rules" JSONB NOT NULL,
    "changelog" TEXT NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MethodologyVersion_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "RatingAction" (
    "id" TEXT NOT NULL,
    "actionNumber" INTEGER NOT NULL,
    "influencerId" TEXT NOT NULL,
    "methodologyVersion" TEXT NOT NULL,
    "status" "ActionStatus" NOT NULL DEFAULT 'draft',
    "type" "ActionType",
    "accuracy" INTEGER,
    "disclosure" INTEGER,
    "walletAlignment" INTEGER,
    "conduct" INTEGER,
    "totalScore" INTEGER,
    "indicatedRating" TEXT,
    "scorecardRating" TEXT,
    "appliedCaps" TEXT[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "notRated" BOOLEAN NOT NULL DEFAULT false,
    "measurableCalls" INTEGER NOT NULL DEFAULT 0,
    "inputs" JSONB,
    "suggestedOutlook" "Outlook",
    "rating" TEXT,
    "outlook" "Outlook",
    "watch" "Watch",
    "watchReason" TEXT,
    "watchSetAt" TIMESTAMP(3),
    "rationale" TEXT,
    "noticeChannel" "NoticeChannel",
    "noticeSentAt" TIMESTAMP(3),
    "publishAfter" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "analystId" TEXT,
    "previousId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatingAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeVote" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "rating" TEXT,
    "outlook" "Outlook",
    "recused" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflictDeclaration" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflictDeclaration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'open',
    "decision" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tokenBalance" DECIMAL(30,9) NOT NULL DEFAULT 0,
    "lastBalanceCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "subjectId" TEXT,
    "chainKey" TEXT,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberSession" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "kind" "TipKind" NOT NULL,
    "evidenceUrl" TEXT NOT NULL,
    "note" TEXT,
    "status" "TipStatus" NOT NULL DEFAULT 'new',
    "promotionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "ArticleKind" NOT NULL,
    "title" TEXT NOT NULL,
    "standfirst" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readMinutes" INTEGER,
    "authorId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ArticleInfluencers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ArticleInfluencers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKeyHash_key" ON "User"("apiKeyHash");

-- CreateIndex
CREATE INDEX "AuditLog_staffId_createdAt_idx" ON "AuditLog"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Influencer_handle_key" ON "Influencer"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_claimedById_key" ON "SocialAccount"("claimedById");

-- CreateIndex
CREATE INDEX "SocialAccount_influencerId_idx" ON "SocialAccount"("influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_platform_handle_key" ON "SocialAccount"("platform", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_influencerId_chainKey_address_key" ON "Wallet"("influencerId", "chainKey", "address");

-- CreateIndex
CREATE UNIQUE INDEX "Call_postUrl_key" ON "Call"("postUrl");

-- CreateIndex
CREATE INDEX "Call_influencerId_postedAt_idx" ON "Call"("influencerId", "postedAt");

-- CreateIndex
CREATE INDEX "Call_socialAccountId_idx" ON "Call"("socialAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CallWalletCheck_callId_walletId_key" ON "CallWalletCheck"("callId", "walletId");

-- CreateIndex
CREATE INDEX "Promotion_influencerId_status_idx" ON "Promotion"("influencerId", "status");

-- CreateIndex
CREATE INDEX "EvidenceSnapshot_callId_idx" ON "EvidenceSnapshot"("callId");

-- CreateIndex
CREATE INDEX "EvidenceSnapshot_promotionId_idx" ON "EvidenceSnapshot"("promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingAction_actionNumber_key" ON "RatingAction"("actionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RatingAction_previousId_key" ON "RatingAction"("previousId");

-- CreateIndex
CREATE INDEX "RatingAction_influencerId_status_idx" ON "RatingAction"("influencerId", "status");

-- CreateIndex
CREATE INDEX "RatingAction_status_publishedAt_idx" ON "RatingAction"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeVote_actionId_staffId_key" ON "CommitteeVote"("actionId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "ConflictDeclaration_staffId_influencerId_key" ON "ConflictDeclaration"("staffId", "influencerId");

-- CreateIndex
CREATE UNIQUE INDEX "Reply_actionId_key" ON "Reply"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_actionId_key" ON "Appeal"("actionId");

-- CreateIndex
CREATE UNIQUE INDEX "Member_walletAddress_key" ON "Member"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "AuthNonce_nonce_key" ON "AuthNonce"("nonce");

-- CreateIndex
CREATE INDEX "AuthNonce_walletAddress_idx" ON "AuthNonce"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "MemberSession_tokenHash_key" ON "MemberSession"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "Tip_status_createdAt_idx" ON "Tip"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_kind_publishedAt_idx" ON "Article"("kind", "publishedAt");

-- CreateIndex
CREATE INDEX "_ArticleInfluencers_B_index" ON "_ArticleInfluencers"("B");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallWalletCheck" ADD CONSTRAINT "CallWalletCheck_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallWalletCheck" ADD CONSTRAINT "CallWalletCheck_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSnapshot" ADD CONSTRAINT "EvidenceSnapshot_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSnapshot" ADD CONSTRAINT "EvidenceSnapshot_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceSnapshot" ADD CONSTRAINT "EvidenceSnapshot_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAction" ADD CONSTRAINT "RatingAction_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAction" ADD CONSTRAINT "RatingAction_methodologyVersion_fkey" FOREIGN KEY ("methodologyVersion") REFERENCES "MethodologyVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAction" ADD CONSTRAINT "RatingAction_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingAction" ADD CONSTRAINT "RatingAction_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "RatingAction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeVote" ADD CONSTRAINT "CommitteeVote_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RatingAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeVote" ADD CONSTRAINT "CommitteeVote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDeclaration" ADD CONSTRAINT "ConflictDeclaration_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflictDeclaration" ADD CONSTRAINT "ConflictDeclaration_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RatingAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "RatingAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberSession" ADD CONSTRAINT "MemberSession_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_influencerId_fkey" FOREIGN KEY ("influencerId") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleInfluencers" ADD CONSTRAINT "_ArticleInfluencers_A_fkey" FOREIGN KEY ("A") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ArticleInfluencers" ADD CONSTRAINT "_ArticleInfluencers_B_fkey" FOREIGN KEY ("B") REFERENCES "Influencer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
