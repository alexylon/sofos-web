import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { LanguageModel, ModelMessage, SystemModelMessage, ToolSet } from 'ai';
import { SharedV2ProviderOptions } from '@ai-sdk/provider';
import { AnthropicEffortValue, Provider } from '@/types/types';
import { SYSTEM_PROMPT } from './systemPrompt';

type GoogleThinkingLevel = NonNullable<NonNullable<GoogleGenerativeAIProviderOptions['thinkingConfig']>['thinkingLevel']>;
type OpenAIReasoningEffort = NonNullable<OpenAIResponsesProviderOptions['reasoningEffort']>;

export interface BuilderInput {
	modelValue: string;
	reasoningEffort: string;
	textVerbosity: string;
	chatId?: string;
	promptMessages: ModelMessage[];
}

export interface BuilderOutput {
	modelName: LanguageModel;
	tools?: ToolSet;
	providerOptions: SharedV2ProviderOptions;
	systemPrompt: string | SystemModelMessage;
	promptMessages: ModelMessage[];
}

const buildAnthropic = ({ modelValue, reasoningEffort, promptMessages }: BuilderInput): BuilderOutput => {
	const anthropicOptions: AnthropicProviderOptions = reasoningEffort === 'none'
		? { thinking: { type: 'disabled' } }
		: {
				thinking: { type: 'adaptive', display: 'summarized' },
				effort: reasoningEffort as AnthropicEffortValue,
			};

	// Anthropic prompt caching: the system prompt is cached for 1 hour, and the
	// conversation up to the last message for 5 minutes, so the cached part grows
	// as the chat goes on. Tools can't be marked for caching on their own: the SDK
	// drops cache settings from provider tools such as web search.
	const systemPrompt: SystemModelMessage = {
		role: 'system',
		content: SYSTEM_PROMPT,
		providerOptions: {
			anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } satisfies AnthropicProviderOptions,
		},
	};

	const last = promptMessages.at(-1);
	const updatedMessages = last
		? [
			...promptMessages.slice(0, -1),
			{
				...last,
				providerOptions: {
					...last.providerOptions,
					anthropic: { cacheControl: { type: 'ephemeral' } } satisfies AnthropicProviderOptions,
				},
			},
		]
		: promptMessages;

	return {
		modelName: anthropic(modelValue),
		tools: { web_search: anthropic.tools.webSearch_20250305({}) },
		providerOptions: { anthropic: anthropicOptions },
		systemPrompt,
		promptMessages: updatedMessages,
	};
};

const buildGoogle = ({ modelValue, reasoningEffort, promptMessages }: BuilderInput): BuilderOutput => ({
	modelName: google(modelValue),
	tools: { google_search: google.tools.googleSearch({}) },
	providerOptions: {
		google: {
			thinkingConfig: {
				thinkingLevel: reasoningEffort as GoogleThinkingLevel,
				includeThoughts: true,
			},
		} satisfies GoogleGenerativeAIProviderOptions,
	},
	systemPrompt: SYSTEM_PROMPT,
	promptMessages,
});

const GPT5_MINI = 'gpt-5-mini';

const buildOpenAI = ({
	modelValue,
	reasoningEffort,
	textVerbosity,
	chatId,
	promptMessages,
}: BuilderInput): BuilderOutput => {
	const isMiniMinimal = reasoningEffort === 'none' && modelValue === GPT5_MINI;

	const tools: ToolSet | undefined = isMiniMinimal
		? undefined
		: {
			web_search: openai.tools.webSearch({
				searchContextSize: 'high',
				userLocation: { type: 'approximate' },
			}),
		};

	const openaiOptions: OpenAIResponsesProviderOptions = {
		reasoningEffort: (isMiniMinimal ? 'minimal' : reasoningEffort) as OpenAIReasoningEffort,
		textVerbosity: textVerbosity as OpenAIResponsesProviderOptions['textVerbosity'],
		// Get the model's reasoning back in encrypted form and send it with the next
		// request, so it doesn't have to reason from scratch after each tool call.
		include: ['reasoning.encrypted_content'],
		store: false,
		reasoningSummary: 'auto',
		// Same key for every request in a chat, so OpenAI is more likely to reuse its
		// cache of the earlier conversation.
		promptCacheKey: chatId,
	};

	return {
		modelName: openai.responses(modelValue),
		tools,
		providerOptions: { openai: openaiOptions },
		systemPrompt: SYSTEM_PROMPT,
		promptMessages,
	};
};

export const buildProviderConfig = (
	provider: string | undefined,
	input: BuilderInput,
): BuilderOutput => {
	switch (provider) {
		case Provider.Anthropic: return buildAnthropic(input);
		case Provider.Google: return buildGoogle(input);
		default: return buildOpenAI(input);
	}
};
