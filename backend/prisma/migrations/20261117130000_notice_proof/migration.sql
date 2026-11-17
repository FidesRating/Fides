-- Notice proof for accounts that are not claimed (staff mention them on X). Additive only.
ALTER TABLE "RatingAction" ADD COLUMN "noticeProofUrl" TEXT;
