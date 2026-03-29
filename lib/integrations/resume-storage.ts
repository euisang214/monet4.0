import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

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

function getLocalStorageHint(supabaseUrl: string): string | null {
    try {
        const { hostname } = new URL(supabaseUrl);
        if (hostname === "127.0.0.1" || hostname === "localhost") {
            return "STORAGE_SUPABASE_URL points to local Supabase, but the local Supabase stack does not appear to be running. Start Supabase locally or switch STORAGE_SUPABASE_URL and STORAGE_SUPABASE_SERVICE_ROLE_KEY to your cloud project values."
        }
    } catch {
        return null;
    }

    return null;
}

function formatStorageErrorMessage(config: ResumeStorageConfig, errorMessage: string): string {
    const localHint = getLocalStorageHint(config.supabaseUrl);

    return [
        `Failed to upload resume to Supabase Storage: ${errorMessage}`,
        `Storage URL: ${config.supabaseUrl}`,
        `Bucket: ${config.bucket}`,
        localHint,
    ]
        .filter(Boolean)
        .join("\n");
}

function normalizeEnvValue(rawValue: string | undefined): string | null {
    const trimmed = rawValue?.trim();
    if (!trimmed) return null;

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith("'") && trimmed.endsWith("'"))
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

function getResumeStorageClient(config: ResumeStorageConfig) {
    return createClient(config.supabaseUrl, config.serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
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
    userId?: string,
): Promise<{ path: string; storageUrl: string }> {
    const config = getResumeStorageConfig();
    const client = getResumeStorageClient(config);
    const path = getUploadPath(scope, userId);

    try {
        const { error } = await client.storage
            .from(config.bucket)
            .upload(path, new Blob([fileBuffer], { type: contentType }), {
                contentType,
                upsert: false,
            });

        if (error) {
            throw new Error(formatStorageErrorMessage(config, error.message));
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(formatStorageErrorMessage(config, message));
    }

    return {
        path,
        storageUrl: buildCanonicalStorageUrl(path),
    };
}

export async function getSignedResumeViewUrl(
    storageUrl: string,
    ttlSeconds = RESUME_SIGNED_URL_TTL_SECONDS,
): Promise<string> {
    if (!isSupabaseResumeUrl(storageUrl)) {
        return storageUrl;
    }

    const path = extractPathFromStorageUrl(storageUrl);
    if (!path) return storageUrl;

    const config = getResumeStorageConfig();
    const client = getResumeStorageClient(config);
    const { data, error } = await client.storage.from(config.bucket).createSignedUrl(path, ttlSeconds);

    if (error) {
        throw new Error(`Failed to create signed resume URL: ${error.message}`);
    }

    const signedUrl = data?.signedUrl;
    if (!signedUrl) {
        throw new Error("Supabase did not return a signed URL");
    }

    return normalizeSignedUrl(signedUrl, config.supabaseUrl);
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
