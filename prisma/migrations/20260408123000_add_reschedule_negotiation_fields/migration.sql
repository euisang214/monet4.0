-- CreateEnum
CREATE TYPE "RescheduleAwaitingParty" AS ENUM ('CANDIDATE', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "RescheduleProposalSource" AS ENUM ('CANDIDATE', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "rescheduleAwaitingParty" "RescheduleAwaitingParty",
ADD COLUMN "rescheduleProposalSource" "RescheduleProposalSource",
ADD COLUMN "rescheduleProposalSlots" JSONB,
ADD COLUMN "rescheduleProposalNote" TEXT,
ADD COLUMN "rescheduleRound" INTEGER NOT NULL DEFAULT 0;
