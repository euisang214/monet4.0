
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeService } from '@/lib/integrations/claude';

// Mock Anthropic SDK
const { mockCreate } = vi.hoisted(() => {
    return { mockCreate: vi.fn() };
});

vi.mock('@anthropic-ai/sdk', () => {
    return {
        default: class MockAnthropic {
            messages = { create: mockCreate };
            constructor(public opts: any) { }
        }
    };
});

describe('ClaudeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return passed=true when API validates', async () => {
        mockCreate.mockResolvedValue({
            content: [{ type: 'text', text: '{"status": "passed", "reason": ""}' }]
        });

        const result = await ClaudeService.validateFeedback('Some text', ['Action 1', 'Action 2', 'Action 3']);

        expect(result.passed).toBe(true);
        expect(result.reasons).toEqual([]);
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
            model: expect.stringMatching(/^claude-/)
        }));
    });

    it('should return passed=false when API rejects', async () => {
        mockCreate.mockResolvedValue({
            content: [{ type: 'text', text: '{"status": "revise", "reason": "Not actionable"}' }]
        });

        const result = await ClaudeService.validateFeedback('Some text', ['Action 1']);

        expect(result.passed).toBe(false);
        expect(result.reasons).toContain('Not actionable');
    });

    it('should parse fenced JSON responses', async () => {
        mockCreate.mockResolvedValue({
            content: [
                {
                    type: 'text',
                    text: `\`\`\`json
{
  "status": "revise",
  "reason": "Feedback fails multiple quality criteria."
}
\`\`\``
                }
            ]
        });

        const result = await ClaudeService.validateFeedback('Some text', ['Action 1', 'Action 2', 'Action 3']);

        expect(result.passed).toBe(false);
        expect(result.reasons).toEqual(['Feedback fails multiple quality criteria.']);
    });

    it('should extract the first JSON object from prose-wrapped responses', async () => {
        mockCreate.mockResolvedValue({
            content: [
                { type: 'thinking', thinking: 'Internal reasoning', signature: 'sig_123' },
                {
                    type: 'text',
                    text: 'Here is the result:\n{"status":"revise","reason":"Needs more specificity"}'
                }
            ]
        });

        const result = await ClaudeService.validateFeedback('Some text', ['Action 1', 'Action 2', 'Action 3']);

        expect(result.passed).toBe(false);
        expect(result.reasons).toEqual(['Needs more specificity']);
    });

    it('should handle JSON parse errors gracefully', async () => {
        mockCreate.mockResolvedValue({
            content: [{ type: 'text', text: 'NOT JSON' }]
        });

        // The service logic catches parse error and throws "Failed to parse Claude response"
        // which then is caught by the outer block and rethrown.
        await expect(ClaudeService.validateFeedback('text', [])).rejects.toThrow('Failed to parse Claude response');
    });

    it('should reject syntactically valid JSON with an invalid shape', async () => {
        mockCreate.mockResolvedValue({
            content: [{ type: 'text', text: '{"status":"unknown","reason":123}' }]
        });

        await expect(ClaudeService.validateFeedback('text', [])).rejects.toThrow('Failed to parse Claude response');
    });

    // We cannot easily test the timeout here without fake timers and a hanging promise, 
    // but the logic is standard Promise.race.
});
