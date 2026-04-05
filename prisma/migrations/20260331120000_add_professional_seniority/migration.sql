CREATE TYPE "ProfessionalSeniority" AS ENUM (
    'analyst',
    'associate',
    'consultant',
    'senior_associate',
    'senior_consultant',
    'manager',
    'senior_manager',
    'vice_president',
    'director',
    'managing_director',
    'principal',
    'counsel',
    'partner'
);

ALTER TABLE "ProfessionalProfile"
    ADD COLUMN "seniority" "ProfessionalSeniority";

UPDATE "ProfessionalProfile" pp
SET "seniority" = CASE
    WHEN canonical_role."title" ILIKE '%managing director%' THEN 'managing_director'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%vice president%' OR canonical_role."title" ~* '(^|[^a-z])vp([^a-z]|$)' THEN 'vice_president'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%senior manager%' THEN 'senior_manager'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%senior consultant%' THEN 'senior_consultant'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%senior associate%' THEN 'senior_associate'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%principal%' THEN 'principal'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%partner%' THEN 'partner'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%counsel%' THEN 'counsel'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%director%' THEN 'director'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%manager%' OR canonical_role."title" ILIKE '%project leader%' THEN 'manager'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%consultant%' THEN 'consultant'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%associate%' THEN 'associate'::"ProfessionalSeniority"
    WHEN canonical_role."title" ILIKE '%analyst%' THEN 'analyst'::"ProfessionalSeniority"
    ELSE NULL
END
FROM (
    SELECT DISTINCT ON (e."professionalId")
        e."professionalId" AS "userId",
        e."title"
    FROM "Experience" e
    WHERE e."type" = 'EXPERIENCE'
    ORDER BY
        e."professionalId",
        CASE WHEN e."isCurrent" = true THEN 0 ELSE 1 END,
        e."startDate" DESC NULLS LAST,
        e."id" DESC
 ) canonical_role
WHERE canonical_role."userId" = pp."userId";

DROP VIEW IF EXISTS "ListingCardView";

CREATE VIEW "ListingCardView" AS
SELECT
    pp."userId",
    canonical_role."company" AS "employer",
    canonical_role."title" AS "title",
    pp."industry",
    pp."seniority",
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
