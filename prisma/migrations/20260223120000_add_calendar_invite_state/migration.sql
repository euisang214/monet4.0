-- Add per-recipient calendar invite state for iMIP request/cancel lifecycle.
ALTER TABLE "Booking"
    ADD COLUMN "candidateCalendarInviteUid" TEXT,
    ADD COLUMN "professionalCalendarInviteUid" TEXT,
    ADD COLUMN "candidateCalendarInviteSequence" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "professionalCalendarInviteSequence" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "candidateCalendarInviteSentAt" TIMESTAMP(3),
    ADD COLUMN "professionalCalendarInviteSentAt" TIMESTAMP(3),
    ADD COLUMN "candidateCalendarInviteCancelledAt" TIMESTAMP(3),
    ADD COLUMN "professionalCalendarInviteCancelledAt" TIMESTAMP(3);
