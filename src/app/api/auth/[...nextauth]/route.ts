import { handlers } from "@/auth"
import { checkRateLimit } from "@/lib/core/rate-limit"

export const { GET } = handlers

export async function POST(req: Request) {
    // Rate limit: 10 attempts per minute per IP (since no session yet for login)
    // checkRateLimit handles IP fallback if identifier is null
    const isAllowed = await checkRateLimit(undefined, 10, 60000);

    if (!isAllowed) {
        return Response.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    return handlers.POST(req as any);
}
