import { randomUUID } from "crypto";

export const DEFAULT_RESUME_BUCKET = "candidate-resumes";
export const RESUME_SIGNED_URL_TTL_SECONDS = 15 * 60;
export const MAX_RESUME_SIZE_BYTES = 4 * 1024 * 1024;
export const RESUME_CONTENT_TYPE = "application/pdf";

type ResumeUploadScope = "signup" | "candidate";
type NullableResumeUrl = string | null | undefined;

interface ResumeStorageConfig {
    bucket: string;
    serviceRoleKey: string;
    supabaseUrl: string;
}

function normalizeEnvValue(rawValue: string | undefined): string | null {
    const trimmed = rawValue?.trim();
    if (!trimmed) return null;

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        const unquoted = trimmed.slice(1, -1).trim();
        return unquoted || null;
    }

    return trimmed;
}

function getBucketName(): string {
    return process.env.SUPABASE_RESUME_BUCKET?.trim() || DEFAULT_RESUME_BUCKET;
}

function getSupabaseUrl(): string | null {
    const raw = normalizeEnvValue(process.env.STORAGE_SUPABASE_URL);
    if (!raw) return null;
    return raw.replace(/\/+$/, "");
}

function getResumeStorageConfig(): ResumeStorageConfig {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = normalizeEnvValue(process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY);
    const bucket = getBucketName();

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase resume storage environment variables are missing");
    }

    return {
        bucket,
        serviceRoleKey,
        supabaseUrl,
    };
}

function encodePath(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map((segment) => encodeURIComponent(segment))
        .join("/");
}

function decodePath(path: string): string {
    return path
        .split("/")
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment))
        .join("/");
}

function getPathFromSupabaseUrl(storageUrl: string): string | null {
    try {
        const parsed = new URL(storageUrl);
        const bucket = getBucketName();
        const expectedPrefix = `/storage/v1/object/${encodeURIComponent(bucket)}/`;

        if (!parsed.pathname.startsWith(expectedPrefix)) {
            return null;
        }

        const encodedPath = parsed.pathname.slice(expectedPrefix.length);
        if (!encodedPath) return null;

        return decodePath(encodedPath);
    } catch {
        return null;
    }
}

function buildCanonicalStorageUrl(path: string): string {
    const supabaseUrl = getSupabaseUrl();
    if (!supabaseUrl) {
        throw new Error("STORAGE_SUPABASE_URL is missing");
    }

    const bucket = getBucketName();
    return `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`;
}

function normalizeSignedUrl(signedUrl: string, supabaseUrl: string): string {
    if (signedUrl.startsWith("http://") || signedUrl.startsWith("https://")) {
        return signedUrl;
    }

    if (signedUrl.startsWith("/storage/v1/")) {
        return `${supabaseUrl}${signedUrl}`;
    }

    if (signedUrl.startsWith("/object/")) {
        return `${supabaseUrl}/storage/v1${signedUrl}`;
    }

    return `${supabaseUrl}/storage/v1/object/sign/${signedUrl.replace(/^\/+/, "")}`;
}

function getUploadPath(scope: ResumeUploadScope, userId?: string): string {
    const now = Date.now();
    const suffix = `${now}-${randomUUID()}.pdf`;

    if (scope === "signup") {
        return `resumes/signup/${suffix}`;
    }

    if (!userId) {
        throw new Error("userId is required for candidate resume uploads");
    }

    return `resumes/${userId}/${suffix}`;
}

export function extractPathFromStorageUrl(storageUrl: string): string | null {
    return getPathFromSupabaseUrl(storageUrl);
}

export function isSupabaseResumeUrl(storageUrl: string): boolean {
    const path = extractPathFromStorageUrl(storageUrl);
    if (!path) return false;

    const expectedUrl = getSupabaseUrl();
    if (!expectedUrl) return true;

    try {
        const expectedOrigin = new URL(expectedUrl).origin;
        return new URL(storageUrl).origin === expectedOrigin;
    } catch {
        return false;
    }
}

export async function uploadResume(
    scope: ResumeUploadScope,
    fileBuffer: ArrayBuffer,
    contentType: string,
    userId?: string
): Promise<{ path: string; storageUrl: string }> {
    const { bucket, serviceRoleKey, supabaseUrl } = getResumeStorageConfig();
    const path = getUploadPath(scope, userId);
    const uploadEndpoint = `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(path)}`;

    const response = await fetch(uploadEndpoint, {
        method: "POST",
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": contentType,
            "x-upsert": "false",
        },
        body: fileBuffer,
    });

    if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(`Failed to upload resume to Supabase Storage (${response.status}): ${details}`);
    }

    return {
        path,
        storageUrl: buildCanonicalStorageUrl(path),
    };
}

export async function getSignedResumeViewUrl(
    storageUrl: string,
    ttlSeconds = RESUME_SIGNED_URL_TTL_SECONDS
): Promise<string> {
    if (!isSupabaseResumeUrl(storageUrl)) {
        return storageUrl;
    }

    const path = extractPathFromStorageUrl(storageUrl);
    if (!path) return storageUrl;

    const { bucket, serviceRoleKey, supabaseUrl } = getResumeStorageConfig();
    const signEndpoint = `${supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${encodePath(path)}`;

    const response = await fetch(signEndpoint, {
        method: "POST",
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: ttlSeconds }),
    });

    if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(`Failed to create signed resume URL (${response.status}): ${details}`);
    }

    const payload = (await response.json()) as { signedURL?: string };
    if (!payload.signedURL) {
        throw new Error("Supabase did not return a signed URL");
    }

    return normalizeSignedUrl(payload.signedURL, supabaseUrl);
}

export function createResumeUrlSigner(ttlSeconds = RESUME_SIGNED_URL_TTL_SECONDS) {
    const cache = new Map<string, Promise<string>>();

    return async (resumeUrl: NullableResumeUrl): Promise<NullableResumeUrl> => {
        if (!resumeUrl) return resumeUrl;

        const cached = cache.get(resumeUrl);
        if (cached) {
            return cached;
        }

        const signingPromise = getSignedResumeViewUrl(resumeUrl, ttlSeconds);
        cache.set(resumeUrl, signingPromise);
        return signingPromise;
    };
}
