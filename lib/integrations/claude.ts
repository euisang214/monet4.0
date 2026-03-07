
import Anthropic from '@anthropic-ai/sdk';
import { QCValidationResult } from '@/lib/shared/qc';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

type ClaudeValidationPayload = {
    status: 'passed' | 'revise';
    reason?: string;
};

type ClaudeContentBlock = {
    type: string;
    text?: string;
};

function collectTextResponse(contentBlocks: ReadonlyArray<ClaudeContentBlock>): string | null {
    const textBlocks = contentBlocks.filter(
        (block): block is ClaudeContentBlock & { type: 'text'; text: string } =>
            block.type === 'text' && typeof block.text === 'string'
    );

    if (textBlocks.length === 0) {
        return null;
    }

    return textBlocks.map((block) => block.text).join('\n').trim();
}

function stripSingleFencedBlock(text: string): string | null {
    const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return match ? match[1].trim() : null;
}

function extractFirstJSONObject(text: string): string | null {
    let start = -1;
    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let index = 0; index < text.length; index += 1) {
        const char = text[index];

        if (start === -1) {
            if (char === '{') {
                start = index;
                depth = 1;
            }
            continue;
        }

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }

            if (char === '\\') {
                isEscaped = true;
                continue;
            }

            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            depth += 1;
            continue;
        }

        if (char === '}') {
            depth -= 1;

            if (depth === 0) {
                return text.slice(start, index + 1);
            }
        }
    }

    return null;
}

function validateClaudePayload(value: unknown): ClaudeValidationPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid Claude payload');
    }

    const { status, reason } = value as Record<string, unknown>;

    if (status !== 'passed' && status !== 'revise') {
        throw new Error('Invalid Claude payload');
    }

    if (reason !== undefined && typeof reason !== 'string') {
        throw new Error('Invalid Claude payload');
    }

    return {
        status,
        reason,
    };
}

function normalizeClaudeJsonText(rawText: string): string {
    const normalizedText = rawText.trim();

    if (normalizedText.startsWith('{') && normalizedText.endsWith('}')) {
        return normalizedText;
    }

    const fencedText = stripSingleFencedBlock(normalizedText);
    if (fencedText) {
        return fencedText;
    }

    const extractedJson = extractFirstJSONObject(normalizedText);
    if (extractedJson) {
        return extractedJson;
    }

    throw new Error('Failed to parse Claude response');
}

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
                    model: 'claude-haiku-4-5-20251001', // Using Haiku for speed/cost, allows upgrade to Sonnet if needed
                    max_tokens: 1024,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: 0,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Claude API timeout')), 30000)
                ),
            ]);

            const rawText = collectTextResponse(response.content);
            if (!rawText) {
                throw new Error('Unexpected response format from Claude');
            }

            try {
                const normalizedJsonText = normalizeClaudeJsonText(rawText);
                const parsed = JSON.parse(normalizedJsonText);
                const result = validateClaudePayload(parsed);
                const passed = result.status === 'passed';

                return {
                    passed,
                    reasons: passed ? [] : [result.reason || 'Feedback did not meet quality standards'],
                };
            } catch {
                console.error('[Claude] JSON parse error:', rawText);
                throw new Error('Failed to parse Claude response');
            }

        } catch (error) {
            console.error('[Claude] Validation failed:', error);
            // Re-throw to trigger worker retry
            throw error;
        }
    }
};
