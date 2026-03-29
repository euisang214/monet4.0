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
export STORAGE_POSTGRES_URL_NON_POOLING="$(strip_wrapping_quotes "${STORAGE_POSTGRES_URL_NON_POOLING:-}")"
export STORAGE_SUPABASE_URL="$(strip_wrapping_quotes "${STORAGE_SUPABASE_URL:-}")"
export STORAGE_SUPABASE_SERVICE_ROLE_KEY="$(strip_wrapping_quotes "${STORAGE_SUPABASE_SERVICE_ROLE_KEY:-}")"
export STRIPE_TEST_SECRET_KEY="$(strip_wrapping_quotes "${STRIPE_TEST_SECRET_KEY:-}")"
export VERCEL_ENABLE_PREVIEW_SEED="$(strip_wrapping_quotes "${VERCEL_ENABLE_PREVIEW_SEED:-}")"
export VERCEL_RUN_PREVIEW_MIGRATIONS="$(strip_wrapping_quotes "${VERCEL_RUN_PREVIEW_MIGRATIONS:-}")"
preview_seed_enabled="$(printf '%s' "${VERCEL_ENABLE_PREVIEW_SEED}" | tr '[:upper:]' '[:lower:]')"
preview_migrations_enabled="$(printf '%s' "${VERCEL_RUN_PREVIEW_MIGRATIONS}" | tr '[:upper:]' '[:lower:]')"

# Production should default to applying migrations so deploys do not drift
# from the Prisma schema. Set VERCEL_RUN_PRODUCTION_MIGRATIONS=false to opt out.
production_migrations_flag="$(strip_wrapping_quotes "${VERCEL_RUN_PRODUCTION_MIGRATIONS:-}")"
if [[ -z "${production_migrations_flag}" ]]; then
    production_migrations_flag="true"
fi
export VERCEL_RUN_PRODUCTION_MIGRATIONS="${production_migrations_flag}"
production_migrations_enabled="$(printf '%s' "${VERCEL_RUN_PRODUCTION_MIGRATIONS}" | tr '[:upper:]' '[:lower:]')"

should_use_non_pooling_url="true"
if [[ "${VERCEL_ENV:-}" == "preview" && "${preview_migrations_enabled}" != "true" ]]; then
    should_use_non_pooling_url="false"
fi
if [[ "${VERCEL_ENV:-}" == "production" && "${production_migrations_enabled}" != "true" ]]; then
    should_use_non_pooling_url="false"
fi

if [[ -n "${STORAGE_POSTGRES_URL_NON_POOLING}" && "${should_use_non_pooling_url}" == "true" ]]; then
    export STORAGE_POSTGRES_PRISMA_URL="${STORAGE_POSTGRES_URL_NON_POOLING}"
fi

if [[ -z "${STORAGE_POSTGRES_PRISMA_URL}" ]]; then
    echo "STORAGE_POSTGRES_PRISMA_URL is missing."
    exit 1
fi

npx prisma generate

if [[ "${VERCEL_ENV:-}" == "preview" && "${preview_migrations_enabled}" != "true" ]]; then
    echo "Skipping Prisma migrations for preview. Set VERCEL_RUN_PREVIEW_MIGRATIONS=true to enable them."
elif [[ "${VERCEL_ENV:-}" == "production" && "${production_migrations_enabled}" != "true" ]]; then
    echo "Skipping Prisma migrations for production. Set VERCEL_RUN_PRODUCTION_MIGRATIONS=true to enable them."
else
    npx prisma migrate deploy
fi

if [[ "${VERCEL_ENV:-}" == "preview" ]]; then
    if [[ "${preview_seed_enabled}" == "true" ]]; then
        if [[ -z "${STORAGE_SUPABASE_URL}" || -z "${STORAGE_SUPABASE_SERVICE_ROLE_KEY}" ]]; then
            echo "STORAGE_SUPABASE_URL and STORAGE_SUPABASE_SERVICE_ROLE_KEY are required for preview seed."
            exit 1
        fi

        if [[ -z "${STRIPE_TEST_SECRET_KEY}" ]]; then
            echo "STRIPE_TEST_SECRET_KEY is required for preview seed."
            exit 1
        fi

        npm run seed:lite
    else
        echo "Skipping preview seed. Set VERCEL_ENABLE_PREVIEW_SEED=true to enable preview database seeding."
    fi
fi

npm run build
