ALTER TABLE "User"
    ADD COLUMN "onboardingRequired" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false;
