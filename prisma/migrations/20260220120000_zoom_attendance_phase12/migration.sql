-- AlterTable
ALTER TABLE "Booking"
ADD COLUMN "candidateZoomJoinUrl" TEXT,
ADD COLUMN "professionalZoomJoinUrl" TEXT,
ADD COLUMN "candidateZoomRegistrantId" TEXT,
ADD COLUMN "professionalZoomRegistrantId" TEXT;

-- CreateTable
CREATE TABLE "ZoomAttendanceEvent" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTs" TIMESTAMP(3) NOT NULL,
    "meetingId" TEXT NOT NULL,
    "meetingUuid" TEXT,
    "participantId" TEXT,
    "participantUserId" TEXT,
    "participantEmail" TEXT,
    "participantName" TEXT,
    "mappedRole" TEXT NOT NULL DEFAULT 'unknown',
    "mappingMethod" TEXT NOT NULL DEFAULT 'unknown',
    "bookingId" TEXT,
    "payload" JSONB NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'pending',
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'UTC',

    CONSTRAINT "ZoomAttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZoomAttendanceEvent_dedupeKey_key" ON "ZoomAttendanceEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "ZoomAttendanceEvent_meetingId_idx" ON "ZoomAttendanceEvent"("meetingId");

-- CreateIndex
CREATE INDEX "ZoomAttendanceEvent_bookingId_idx" ON "ZoomAttendanceEvent"("bookingId");

-- CreateIndex
CREATE INDEX "ZoomAttendanceEvent_eventTs_idx" ON "ZoomAttendanceEvent"("eventTs");

-- CreateIndex
CREATE INDEX "ZoomAttendanceEvent_createdAt_idx" ON "ZoomAttendanceEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "ZoomAttendanceEvent"
ADD CONSTRAINT "ZoomAttendanceEvent_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
