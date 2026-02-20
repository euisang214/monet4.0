#!/usr/bin/env bash
set -euo pipefail

strip_wrapping_quotes() {
    local value="${1:-}"

    if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
        value="${value:1:${#value}-2}"
    elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
        value="${value:1:${#value}-2}"
    fi

    printf '%s' "${value}"
}

if [[ -z "${DATABASE_URL:-}" || "${DATABASE_URL:-}" == "STORAGE_POSTGRES_PRISMA_URL" ]]; then
    export DATABASE_URL="${STORAGE_POSTGRES_PRISMA_URL:-}"
fi

if [[ -z "${SUPABASE_URL:-}" || "${SUPABASE_URL:-}" == "STORAGE_SUPABASE_URL" ]]; then
    export SUPABASE_URL="${STORAGE_SUPABASE_URL:-}"
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" || "${SUPABASE_SERVICE_ROLE_KEY:-}" == "STORAGE_SUPABASE_SERVICE_ROLE_KEY" ]]; then
    export SUPABASE_SERVICE_ROLE_KEY="${STORAGE_SUPABASE_SERVICE_ROLE_KEY:-}"
fi

export DATABASE_URL="$(strip_wrapping_quotes "${DATABASE_URL:-}")"
export SUPABASE_URL="$(strip_wrapping_quotes "${SUPABASE_URL:-}")"
export SUPABASE_SERVICE_ROLE_KEY="$(strip_wrapping_quotes "${SUPABASE_SERVICE_ROLE_KEY:-}")"

if [[ -z "${DATABASE_URL}" ]]; then
    echo "DATABASE_URL is missing. Set DATABASE_URL or STORAGE_POSTGRES_PRISMA_URL in Vercel."
    exit 1
fi

npx prisma generate
npx prisma migrate deploy

if [[ "${VERCEL_ENV:-}" == "preview" ]]; then
    if [[ -z "${SUPABASE_URL}" || -z "${SUPABASE_SERVICE_ROLE_KEY}" ]]; then
        echo "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for preview seed."
        exit 1
    fi

    npm run seed:lite
fi

npm run build
