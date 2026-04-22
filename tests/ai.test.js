import { describe, it, expect, jest } from '@jest/globals';
import { HuggingFaceClient } from '../commands/src/lib/ai.js';

describe('HuggingFaceClient', () => {
    it('throws when no token is provided', () => {
        expect(() => new HuggingFaceClient()).toThrow(/token required/i);
        expect(() => new HuggingFaceClient('')).toThrow(/token required/i);
    });

    it('constructs successfully with a token', () => {
        const client = new HuggingFaceClient('hf_test_token');
        expect(client.hf).toBeDefined();
    });

    it('returns empty string for empty input', async () => {
        const client = new HuggingFaceClient('hf_test_token');
        client.hf = { summarization: async () => ({ summary_text: 'summary' }) };
        const result = await client.aiSummary('');
        expect(result).toBe('');
    });

    it('returns empty string for whitespace-only input', async () => {
        const client = new HuggingFaceClient('hf_test_token');
        client.hf = { summarization: async () => ({ summary_text: 'summary' }) };
        const result = await client.aiSummary('   ');
        expect(result).toBe('');
    });

    it('calls summarization and returns result', async () => {
        const client = new HuggingFaceClient('hf_test_token');
        client.hf = {
            summarization: async ({ model, inputs, parameters }) => {
                expect(model).toBe('facebook/bart-large-cnn');
                expect(parameters.max_length).toBe(120);
                expect(parameters.min_length).toBe(30);
                return { summary_text: 'A concise summary.' };
            },
        };

        const result = await client.aiSummary('Some long text that needs to be summarized for the user.');
        expect(result).toBe('A concise summary.');
    });

    it('accepts custom maxLength', async () => {
        const client = new HuggingFaceClient('hf_test_token');
        client.hf = {
            summarization: async ({ parameters }) => {
                expect(parameters.max_length).toBe(200);
                return { summary_text: 'Long summary.' };
            },
        };

        const result = await client.aiSummary('Some text to summarize here.', 200);
        expect(result).toBe('Long summary.');
    });

    it('handles API errors gracefully', async () => {
        const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const client = new HuggingFaceClient('hf_test_token');
        client.hf = {
            summarization: async () => {
                throw new Error('API rate limit exceeded');
            },
        };

        const result = await client.aiSummary('Some text to summarize.');
        expect(result).toBeUndefined();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('truncates input to 1024 chars for the API call', async () => {
        const client = new HuggingFaceClient('hf_test_token');
        const longText = 'A'.repeat(2000);
        client.hf = {
            summarization: async ({ inputs }) => {
                expect(inputs.length).toBeLessThanOrEqual(1024);
                return { summary_text: 'Summary of truncated text.' };
            },
        };

        await client.aiSummary(longText);
    });
});
