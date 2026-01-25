
import Anthropic from '@anthropic-ai/sdk';
import { QCValidationResult } from '@/lib/shared/qc';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

export const ClaudeService = {
    /**
     * Validates feedback using Claude API.
     * Enforces strict timeout of 30s.
     * Returns whether it passed and any reasons for revision.
     */
    async validateFeedback(text: string, actionItems: string[]): Promise<QCValidationResult> {
        // Construct the prompt
        const prompt = `
You are a Quality Control Auditor for a professional consultation platform.
Your job is to verify that the feedback provided by a professional consultant meets our strict quality standards.

INPUT DATA:
Feedback Text: "${text}"
Action Items: ${JSON.stringify(actionItems)}

RUBRIC:
1.  **Word Count**: The feedback text must be substantially informative (approx. 200+ words).
2.  **Action Items**: There must be exactly 3 actionable, distinct steps.

You must respond with a JSON object ONLY. No markdown, no explanations outside the JSON.
Format:
{
  "status": "passed" | "revise",
  "reason": "string explaining failure" (or empty string if passed)
}

If the feedback uses very little actual content (gibberish, repeated text to game the word count), mark as "revise".
Atomic checks:
- If < 200 words, status = "revise".
- If != 3 actions, status = "revise".
- If actions are not actionable or relevant, status = "revise".
`;

        try {
            // Strict timeout wrapper
            const response = await Promise.race([
                anthropic.messages.create({
                    model: 'claude-3-haiku-20240307', // Using Haiku for speed/cost, allows upgrade to Sonnet if needed
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Claude API timeout')), 30000)
                ),
            ]);

            const contentBlock = response.content[0];
            if (contentBlock.type !== 'text') {
                throw new Error('Unexpected response format from Claude');
            }

            try {
                const result = JSON.parse(contentBlock.text);
                const passed = result.status === 'passed';

                return {
                    passed,
                    reasons: passed ? [] : [result.reason || 'Feedback did not meet quality standards'],
                };
            } catch (parseError) {
                console.error('[Claude] JSON parse error:', contentBlock.text);
                throw new Error('Failed to parse Claude response');
            }

        } catch (error) {
            console.error('[Claude] Validation failed:', error);
            // Re-throw to trigger worker retry
            throw error;
        }
    }
};
