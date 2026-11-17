-- Staff sign in with a wallet session; the role comes from the STAFF_WALLETS allowlist.
-- Additive only: no data is removed. "apiKeyHash" stays as a deprecated column.
ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");
