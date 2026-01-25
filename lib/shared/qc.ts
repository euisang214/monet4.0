export interface QCValidationResult {
    passed: boolean;
    reasons: string[];
}

/**
 * Validates feedback content against QC requirements.
 * Rules:
 * 1. Minimum 200 words.
 * 2. Exactly 3 action items.
 */
export function validateFeedbackRequirements(
    text: string,
    actions: string[]
): QCValidationResult {
    const reasons: string[] = [];

    // 1. Word count check
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount < 200) {
        reasons.push(`Word count is ${wordCount}, minimum required is 200.`);
    }

    // 2. Action items check
    if (actions.length !== 3) {
        reasons.push(`Found ${actions.length} action items, exactly 3 are required.`);
    }

    return {
        passed: reasons.length === 0,
        reasons,
    };
}
