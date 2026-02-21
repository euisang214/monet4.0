import { auth } from "@/auth";
import {
    OAuthDisconnectLastMethodError,
    OAuthProviderNotConnectedError,
    OAuthService,
} from "@/lib/domain/auth/oauth-service";

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ provider: string }> }
) {
    const session = await auth();
    if (!session?.user) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    try {
        const { provider } = await params;
        const data = await OAuthService.disconnectProvider(session.user.id, provider);
        return Response.json({ data });
    } catch (error) {
        if (error instanceof OAuthProviderNotConnectedError) {
            return Response.json({ error: error.message }, { status: 404 });
        }
        if (error instanceof OAuthDisconnectLastMethodError) {
            return Response.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof Error && error.message === "invalid_provider") {
            return Response.json({ error: error.message }, { status: 400 });
        }
        console.error("Disconnect provider error:", error);
        return Response.json({ error: "internal_error" }, { status: 500 });
    }
}
