CREATE INDEX "Booking_candidateId_status_startAt_idx"
ON "Booking"("candidateId", "status", "startAt");

CREATE INDEX "Booking_candidateId_status_expiresAt_idx"
ON "Booking"("candidateId", "status", "expiresAt");

CREATE INDEX "Booking_professionalId_status_startAt_idx"
ON "Booking"("professionalId", "status", "startAt");

CREATE INDEX "Booking_professionalId_status_expiresAt_idx"
ON "Booking"("professionalId", "status", "expiresAt");

CREATE INDEX "Booking_professionalId_status_endAt_idx"
ON "Booking"("professionalId", "status", "endAt");

CREATE INDEX "Availability_userId_busy_start_idx"
ON "Availability"("userId", "busy", "start");
