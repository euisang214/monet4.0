-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "lastNudgeSentAt" TIMESTAMP(3),
ADD COLUMN     "payoutReleasedAt" TIMESTAMP(3),
ADD COLUMN     "refundCreatedAt" TIMESTAMP(3);
