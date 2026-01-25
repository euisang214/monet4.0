/**
 * Feature Flags
 * 
 * Centralized feature flag definitions. Use these instead of accessing
 * process.env directly for feature toggles.
 * 
 * @see CLAUDE.md lines 2036-2054
 */

export const flags = {
    /**
     * Enhanced LinkedIn features (profile enrichment, connection sync)
     * Default: false
     */
    FEATURE_LINKEDIN_ENHANCED: process.env.FEATURE_LINKEDIN_ENHANCED === 'true',

    /**
     * LLM-based QC validation using Claude API
     * Default: true (opt-out)
     */
    FEATURE_QC_LLM: process.env.FEATURE_QC_LLM !== 'false',
} as const;

export type FeatureFlags = typeof flags;
