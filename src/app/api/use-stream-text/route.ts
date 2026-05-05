import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { convertToModelMessages, ModelMessage, streamText, SystemModelMessage } from 'ai';
import { SharedV2ProviderOptions } from '@ai-sdk/provider';

// maxDuration streaming response time is 60 seconds
export const maxDuration = 60;

const ANTHROPIC_THINKING_BUDGET: Record<string, number> = {
	low: 6000,
	medium: 12000,
	high: 24000,
};

const SYSTEM_PROMPT = `When presenting any code examples or data tables, always use Markdown code fences.
- Code: wrap with triple backticks and specify the language (e.g., \`\`\`python, \`\`\`rust). Never show code outside fences.
- Tables: wrap GitHub-flavored Markdown tables inside \`\`\`markdown fences.

Math formatting (compatible with remark-math + rehype-katex)

- Inline math: wrap with single dollar signs: $ ... $ (e.g., $y' + p(x)y = q(x)$).
- Display math: put on its own lines wrapped with double dollar signs:

  $$
  y(x)=e^{-\\int p}\\!\\left(C+\\int e^{\\int p} q\\,dx\\right)
  $$

  Leave a blank line before and after the block.

- Do NOT wrap LaTeX math in code fences. Avoid \\[ ... \\] and \\( ... \\).
- Use standard LaTeX commands only (e.g., \\partial, \\int, \\frac{a}{b}, ^, _); no Unicode math symbols.
- For multi-line/aligned display, use environments KaTeX supports inside $$ ... $$:
  \\begin{aligned} ... \\end{aligned}, \\begin{gathered} ... \\end{gathered}, \\begin{cases} ... \\end{cases}, matrices, etc.
- Don't rely on equation numbering or \\tag; KaTeX typically renders unnumbered math.

Example:

Inline: The solution to $y'+p(x)y=q(x)$ is shown below.

Display:
$$
\\frac{\\partial u}{\\partial t}=\\kappa \\frac{\\partial^2 u}{\\partial x^2},\\quad
u(x,t)=(G_t * u_0)(x),\\quad
G_t(x)=\\frac{1}{\\sqrt{4\\pi \\kappa t}}\\,e^{-x^2/(4\\kappa t)}.
$$

Always use the metric system for all measurements. If the user uses other units, convert them and answer in metric.
Show imperial units only when the user explicitly asks for them.

Use only English or Bulgarian in your replies, choosing the one that best matches the current conversation context. 
If any other language appears, still respond exclusively in English or Bulgarian, prioritizing whichever of these two is already present in the context, 
unless you are explicitly asked to use a different language.

Do not add follow-up questions, invitations for the user to provide more details, or suggestions like "If you tell me X, I can do Y" unless the user explicitly asks for that.
Do not propose next steps or additional topics unless they are strictly required to answer the question.`;

export async function POST(req: Request) {
	const { messages, model, reasoningEffort, textVerbosity, id: chatId } = await req.json();

	const promptMessages: ModelMessage[] = await convertToModelMessages(messages);
	let systemPrompt: string | SystemModelMessage = SYSTEM_PROMPT;

	let modelName;
	let tools;
	let providerOptions: SharedV2ProviderOptions;

	if (model.provider === 'anthropic') {
		modelName = anthropic(model.value);
		tools = { web_search: anthropic.tools.webSearch_20250305({}) };

		// Opus rejects `thinking: { type: 'enabled', budget_tokens }` with a 400
		// starting at 4.7 and instead uses adaptive thinking + the `effort`
		// parameter to dial token spend. Adaptive thinking also omits thinking
		// content by default, so opt back into `display: 'summarized'` to keep
		// the reasoning UI populated.
		const anthropicOptions: AnthropicProviderOptions = reasoningEffort === 'none'
			? { thinking: { type: 'disabled' } }
			: model.value.startsWith('claude-opus')
				? {
					thinking: { type: 'adaptive', display: 'summarized' },
					effort: reasoningEffort as 'low' | 'medium' | 'high',
				}
				: { thinking: { type: 'enabled', budgetTokens: ANTHROPIC_THINKING_BUDGET[reasoningEffort] ?? 0 } };

		providerOptions = {
			anthropic: anthropicOptions,
		};

		// 1h breakpoint on the (static) system prompt and a 5m rolling
		// breakpoint on the last message so the cached prefix grows with
		// the conversation instead of restarting each turn. The SDK strips
		// cache_control from provider-supplied tools, so webSearch_20250305
		// can't carry a tools breakpoint.
		systemPrompt = {
			role: 'system',
			content: SYSTEM_PROMPT,
			providerOptions: {
				anthropic: { cacheControl: { type: 'ephemeral', ttl: '1h' } } satisfies AnthropicProviderOptions,
			},
		};
		const last = promptMessages.at(-1);
		if (last) {
			promptMessages[promptMessages.length - 1] = {
				...last,
				providerOptions: {
					...last.providerOptions,
					anthropic: { cacheControl: { type: 'ephemeral' } } satisfies AnthropicProviderOptions,
				},
			};
		}
	} else if (model.provider === 'google') {
		modelName = google(model.value);
		tools = { google_search: google.tools.googleSearch({}) };

		providerOptions = {
			google: {
				thinkingConfig: { thinkingLevel: reasoningEffort, includeThoughts: true },
			} satisfies GoogleGenerativeAIProviderOptions,
		};
	} else {
		modelName = openai.responses(model.value);

		const isMiniMinimal = reasoningEffort === 'none' && model.value === 'gpt-5-mini';

		if (!isMiniMinimal) {
			tools = {
				web_search: openai.tools.webSearch({
					searchContextSize: 'high',
					userLocation: { type: 'approximate' },
				}),
			};
		}

		providerOptions = {
			openai: {
				reasoningEffort: isMiniMinimal ? 'minimal' : reasoningEffort,
				textVerbosity,
				// Round-trip the encrypted hidden chain-of-thought so the model
				// doesn't re-derive its reasoning on every tool turn.
				include: ['reasoning.encrypted_content'],
				store: false, // No data retention - makes interaction stateless
				reasoningSummary: 'auto',
				// Per-chat routing key so follow-up turns land on the same
				// OpenAI cache node and the prefix actually hits its prompt
				// cache. Cache identity is keyed on prefix bytes; this only
				// affects routing.
				promptCacheKey: chatId,
			} satisfies OpenAIResponsesProviderOptions,
		};
	}

	try {
		const result = streamText({
			model: modelName,
			messages: promptMessages,
			system: systemPrompt,
			providerOptions,
			tools,
			async onStepFinish({ response }) {
			},
			async onFinish({ text, toolCalls, toolResults, usage, finishReason, response }) {
				// implement your own logic here, e.g. for storing messages
				// or recording token usage
			},
			async onError({ error }) {
				if (error instanceof Error) {
					console.error('Error:', error.message);
				}
			},
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		const message = error instanceof Error ? `Server error: ${error.message}` : 'Server error: unknown error';
		return new Response(message, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
}
