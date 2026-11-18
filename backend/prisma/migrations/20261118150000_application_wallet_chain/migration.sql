-- The applicant picks the chain of the login wallet at the claim screen. It becomes a rating wallet when staff accept the application.
-- Additive only: one nullable column. Existing rows keep NULL and get no automatic wallet.
ALTER TABLE "Application" ADD COLUMN "walletChain" TEXT;
