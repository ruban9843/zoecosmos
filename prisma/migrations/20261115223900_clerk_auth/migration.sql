-- Clerk owns authentication; retain the application user and role records.
ALTER TABLE "User"
  ADD COLUMN "clerkUserId" TEXT;

CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

ALTER TABLE "User"
  DROP COLUMN "emailVerified",
  DROP COLUMN "passwordHash";

DROP TABLE "VerificationToken";
DROP TABLE "Session";
DROP TABLE "Account";
