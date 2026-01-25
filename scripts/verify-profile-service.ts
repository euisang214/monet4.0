import { loadEnvConfig } from "@next/env";
import { Role } from "@prisma/client";

// Load env vars immediately
loadEnvConfig(process.cwd());

async function main() {
    console.log("Starting Profile Service Verification...");

    // Dynamic imports to ensure env vars are loaded before Prisma client initialization
    const { prisma } = await import("@/lib/core/db");
    const {
        upsertProfessionalProfile,
        upsertCandidateProfile,
        getProfessionalProfile,
    } = await import("@/lib/domain/users/service");

    const proEmail = `pro-test-${Date.now()}@monet.local`;
    const candEmail = `cand-test-${Date.now()}@monet.local`;

    // 1. Create Users
    console.log("Creating users...");
    const proUser = await prisma.user.create({
        data: {
            email: proEmail,
            role: Role.PROFESSIONAL,
            hashedPassword: "password", // Dummy
        },
    });
    const candUser = await prisma.user.create({
        data: {
            email: candEmail,
            role: Role.CANDIDATE,
            hashedPassword: "password", // Dummy
        },
    });

    console.log(`Created Pro: ${proUser.id}, Candidate: ${candUser.id}`);

    // 2. Upsert Professional Profile
    console.log("Upserting Professional Profile...");
    const proData = {
        employer: "Acme Corp",
        title: "Senior Engineer",
        bio: "I build things.",
        priceCents: 15000,
        availabilityPrefs: { weekdays: true },
        corporateEmail: "work@acme.com",
        timezone: "America/New_York",
        interests: ["Coding", "Design"],
        experience: [
            {
                company: "Beta Inc",
                startDate: new Date("2020-01-01"),
                endDate: new Date("2022-01-01"),
                title: "Engineer",
                isCurrent: false,
                positionHistory: [],
            },
        ],
        education: [],
        activities: [
            {
                company: "Chess Club",
                title: "Member",
                startDate: new Date("2021-01-01"),
                isCurrent: true,
                positionHistory: [],
            },
        ],
    };

    await upsertProfessionalProfile(proUser.id, proData as any);
    console.log("Professional Profile Upserted.");

    // 3. Upsert Candidate Profile
    console.log("Upserting Candidate Profile...");
    const candData = {
        resumeUrl: "https://example.com/resume.pdf",
        interests: ["Learning"],
        experience: [],
        education: [],
        activities: [],
    };
    await upsertCandidateProfile(candUser.id, candData);
    console.log("Candidate Profile Upserted.");

    // 4. Verification: Get Pro Profile as Self
    console.log("Verifying Logic 1: Get Pro Profile as Self (Should see full data)...");
    const profileAsSelf = await getProfessionalProfile(proUser.id, proUser.id);

    if (profileAsSelf?.isRedacted) {
        console.error("FAILED: Profile should NOT be redacted for self.");
        process.exit(1);
    }
    if (profileAsSelf?.corporateEmail !== "work@acme.com") {
        console.error("FAILED: Corporate email mismatch for self.");
        console.log("Got:", profileAsSelf?.corporateEmail);
        process.exit(1);
    }
    // Check activities
    if (profileAsSelf?.activities.length !== 1) {
        console.error("FAILED: Activities count mismatch.");
        process.exit(1);
    }
    console.log("PASSED: Self view is correct.");


    // 5. Verification: Get Pro Profile as Candidate (No Booking)
    console.log("Verifying Logic 2: Get Pro Profile as Candidate (No Booking -> Redacted)...");
    const profileAsStranger = await getProfessionalProfile(proUser.id, candUser.id);

    if (!profileAsStranger?.isRedacted) {
        console.error("FAILED: Profile SHOULD be redacted for stranger.");
        process.exit(1);
    }
    if (profileAsStranger?.corporateEmail !== "REDACTED") {
        console.error("FAILED: Corporate email should be REDACTED.");
        console.log("Got:", profileAsStranger?.corporateEmail);
        process.exit(1);
    }
    if (profileAsStranger?.user.email !== "REDACTED") {
        console.error("FAILED: User email should be REDACTED.");
        console.log("Got:", profileAsStranger?.user.email);
        process.exit(1);
    }
    console.log("PASSED: Stranger view is correctly redacted.");

    // 6. Update Profile
    console.log("Verifying Logic 3: Update Profile...");
    const updatedProData = {
        ...proData,
        title: "Staff Engineer"
    };
    await upsertProfessionalProfile(proUser.id, updatedProData as any);
    const updatedProfile = await getProfessionalProfile(proUser.id, proUser.id);
    if (updatedProfile?.title !== "Staff Engineer") {
        console.error("FAILED: Profile update did not persist.");
        process.exit(1);
    }
    console.log("PASSED: Profile update persisted.");

    console.log("\nALL VERIFICATION TESTS PASSED!");

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
