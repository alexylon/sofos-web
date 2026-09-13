import type { ModelMessage } from 'ai';

// GPT models with web search sometimes leave OpenAI's citation markers in the
// answer. The delimiters around them are invisible characters, so the user is
// left looking at a stray "citeturn0search0turn0search1". Take the space in
// front too, and drop a half-written marker so it can't flash while streaming.
const CITATION_SPAN = /[ \t]*\ue200[^\ue200\ue201]*(?:\ue201|$)/g;

// The same markers once the invisible delimiters are gone.
const CITATION_TOKENS = /[ \t]*(?:cite|filecite|navlist|video|image)(?:turn\d+[a-z]+\d+(?:L\d+-L\d+)?)+/g;

export const stripCitationMarkup = (text: string): string =>
	text.replace(CITATION_SPAN, '').replace(CITATION_TOKENS, '');

export const stripCitationsFromHistory = (messages: ModelMessage[]): ModelMessage[] =>
	messages.map(message => {
		if (message.role !== 'assistant') return message;

		if (typeof message.content === 'string') {
			return { ...message, content: stripCitationMarkup(message.content) };
		}

		return {
			...message,
			content: message.content.map(part =>
				part.type === 'text' ? { ...part, text: stripCitationMarkup(part.text) } : part,
			),
		};
	});
