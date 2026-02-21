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

export STORAGE_POSTGRES_PRISMA_URL="$(strip_wrapping_quotes "${STORAGE_POSTGRES_PRISMA_URL:-}")"
export STORAGE_SUPABASE_URL="$(strip_wrapping_quotes "${STORAGE_SUPABASE_URL:-}")"
export STORAGE_SUPABASE_SERVICE_ROLE_KEY="$(strip_wrapping_quotes "${STORAGE_SUPABASE_SERVICE_ROLE_KEY:-}")"

if [[ -z "${STORAGE_POSTGRES_PRISMA_URL}" ]]; then
    echo "STORAGE_POSTGRES_PRISMA_URL is missing."
    exit 1
fi

npx prisma generate
npx prisma migrate deploy

if [[ "${VERCEL_ENV:-}" == "preview" ]]; then
    if [[ -z "${STORAGE_SUPABASE_URL}" || -z "${STORAGE_SUPABASE_SERVICE_ROLE_KEY}" ]]; then
        echo "STORAGE_SUPABASE_URL and STORAGE_SUPABASE_SERVICE_ROLE_KEY are required for preview seed."
        exit 1
    fi

    npm run seed:lite
fi

npm run build
