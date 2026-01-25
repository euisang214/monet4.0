-- CreateView for ListingCardView
-- This view provides an optimized query for professional listings

CREATE VIEW "ListingCardView" AS
SELECT
  pp."userId",
  pp."employer",
  pp."title",
  pp."bio",
  pp."priceCents"
FROM "ProfessionalProfile" pp
INNER JOIN "User" u ON pp."userId" = u."id"
WHERE pp."verifiedAt" IS NOT NULL;
