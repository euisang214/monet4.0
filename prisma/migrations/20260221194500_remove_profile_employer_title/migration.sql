-- Normalize professional current-role experience before removing legacy role columns.
CREATE TEMP TABLE "_canonical_professional_experience" (
    "experienceId" TEXT PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO "_canonical_professional_experience" ("experienceId")
SELECT "experienceId"
FROM (
    SELECT
        e."id" AS "experienceId",
        ROW_NUMBER() OVER (
            PARTITION BY pp."userId"
            ORDER BY
                CASE
                    WHEN e."isCurrent" = true
                        AND NULLIF(BTRIM(pp."employer"), '') IS NOT NULL
                        AND NULLIF(BTRIM(pp."title"), '') IS NOT NULL
                        AND e."company" = pp."employer"
                        AND e."title" = pp."title" THEN 0
                    WHEN NULLIF(BTRIM(pp."employer"), '') IS NOT NULL
                        AND NULLIF(BTRIM(pp."title"), '') IS NOT NULL
                        AND e."company" = pp."employer"
                        AND e."title" = pp."title" THEN 1
                    WHEN e."isCurrent" = true THEN 2
                    ELSE 3
                END,
                e."startDate" DESC NULLS LAST,
                e."id" DESC
        ) AS rank
    FROM "ProfessionalProfile" pp
    INNER JOIN "Experience" e
        ON e."professionalId" = pp."userId"
        AND e."type" = 'EXPERIENCE'
) ranked_experience
WHERE rank = 1;

UPDATE "Experience"
SET "isCurrent" = false
WHERE "professionalId" IS NOT NULL
    AND "type" = 'EXPERIENCE';

UPDATE "Experience" e
SET
    "isCurrent" = true,
    "endDate" = NULL
FROM "_canonical_professional_experience" c
WHERE e."id" = c."experienceId";

-- Create a synthetic current experience only when a completed professional has none.
INSERT INTO "Experience" (
    "id",
    "company",
    "location",
    "startDate",
    "endDate",
    "isCurrent",
    "title",
    "description",
    "positionHistory",
    "professionalId",
    "candidateId",
    "type",
    "professionalActivityId",
    "candidateActivityId"
)
SELECT
    CONCAT('synthetic_prof_exp_', pp."userId"),
    COALESCE(NULLIF(BTRIM(pp."employer"), ''), 'Unknown'),
    NULL,
    COALESCE(pp."verifiedAt", CURRENT_TIMESTAMP),
    NULL,
    true,
    COALESCE(NULLIF(BTRIM(pp."title"), ''), 'Professional'),
    'Migrated from legacy profile role fields.',
    '[]'::jsonb,
    pp."userId",
    NULL,
    'EXPERIENCE',
    NULL,
    NULL
FROM "ProfessionalProfile" pp
INNER JOIN "User" u
    ON u."id" = pp."userId"
    AND u."role" = 'PROFESSIONAL'
    AND u."onboardingCompleted" = true
WHERE NOT EXISTS (
    SELECT 1
    FROM "Experience" e
    WHERE e."professionalId" = pp."userId"
        AND e."type" = 'EXPERIENCE'
);

DROP VIEW IF EXISTS "ListingCardView";
DROP INDEX IF EXISTS "ProfessionalProfile_employer_idx";

ALTER TABLE "ProfessionalProfile"
    DROP COLUMN "employer",
    DROP COLUMN "title";

CREATE INDEX IF NOT EXISTS "Experience_professionalId_type_isCurrent_startDate_idx"
    ON "Experience"("professionalId", "type", "isCurrent", "startDate" DESC);

CREATE VIEW "ListingCardView" AS
SELECT
    pp."userId",
    canonical_role."company" AS "employer",
    canonical_role."title" AS "title",
    pp."bio",
    pp."priceCents"
FROM "ProfessionalProfile" pp
INNER JOIN "User" u ON pp."userId" = u."id"
INNER JOIN LATERAL (
    SELECT
        e."company",
        e."title"
    FROM "Experience" e
    WHERE e."professionalId" = pp."userId"
      AND e."type" = 'EXPERIENCE'
    ORDER BY
        CASE WHEN e."isCurrent" = true THEN 0 ELSE 1 END,
        e."startDate" DESC NULLS LAST,
        e."id" DESC
    LIMIT 1
) canonical_role ON true
WHERE pp."verifiedAt" IS NOT NULL;
