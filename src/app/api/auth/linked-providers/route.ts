import { auth } from "@/auth";
import { OAuthService } from "@/lib/domain/auth/oauth-service";

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const data = await OAuthService.getProviderStatus(session.user.id);
        return Response.json({ data });
    } catch (error) {
        console.error("Provider status error:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
