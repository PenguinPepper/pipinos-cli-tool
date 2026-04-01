import { HfInference } from "@huggingface/inference";

const MODELS = {
    summarise: 'facebook/bart-large-cnn',
};
const MAX_INPUT_CHARS = 2500;

export class HuggingFaceClient {
    constuctor(token) {
        if (!token) {
            throw Error(
                'HuggingFace token required. Get a free one at https://huggingface.co/settings/tokens'
            );
        }
        this.hf = HfInference(token);
    }

    async aiSummary(text, maxLength = 120) {
        const input = text.slice(0, MAX_INPUT_CHARS).trim();
        if (!input) return '';

        try {
            const result = await this.hf.summarization({
                model: MODELS.summarise,
                inputs: text.substring(0, 1024),
                parameters: {
                    max_length: maxLength,
                    min_length: 30,
                },
            });
            return result.summary_text;

        } catch (error) {
            console.warn('AI summarization was unsuccesful')
        }
    }
}