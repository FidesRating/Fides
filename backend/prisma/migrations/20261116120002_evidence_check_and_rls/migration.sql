-- Evidence provenance: a snapshot belongs to exactly one call or one promotion.
ALTER TABLE "EvidenceSnapshot"
  ADD CONSTRAINT "EvidenceSnapshot_one_target_chk"
  CHECK (("callId" IS NULL) <> ("promotionId" IS NULL));

-- Browsers never talk to the database directly. Enable RLS on every table with no policies,
-- so any role that is not the table owner (for example Supabase anon/authenticated) sees nothing.
-- The application connects as the owner role, which bypasses RLS.
ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Appeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Article" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthNonce" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Call" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CallWalletCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CommitteeVote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConflictDeclaration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EvidenceSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Influencer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MemberSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MethodologyVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Promotion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RatingAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reply" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SocialAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Tip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Wallet" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_ArticleInfluencers" ENABLE ROW LEVEL SECURITY;
