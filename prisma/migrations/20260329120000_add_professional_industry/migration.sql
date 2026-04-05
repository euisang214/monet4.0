CREATE TYPE "ProfessionalIndustry" AS ENUM ('finance', 'consulting', 'law');

ALTER TABLE "ProfessionalProfile"
    ADD COLUMN "industry" "ProfessionalIndustry";

DROP VIEW IF EXISTS "ListingCardView";

CREATE VIEW "ListingCardView" AS
SELECT
    pp."userId",
    canonical_role."company" AS "employer",
    canonical_role."title" AS "title",
    pp."industry",
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
