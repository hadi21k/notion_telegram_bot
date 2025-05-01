-- AlterTable
ALTER TABLE "Token" ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
