import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { google, GoogleGenerativeAIProviderOptions } from '@ai-sdk/google';
import { convertToModelMessages, streamText, StreamTextResult } from 'ai';
import { SharedV2ProviderOptions } from '@ai-sdk/provider';

// maxDuration streaming response time is 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
	// Extract the data from the body of the request
	const requestBody = await req.json();
	const { messages, model, reasoningEffort, textVerbosity } = requestBody;

	let modelName;
	let tools;
	let providerOptions: SharedV2ProviderOptions;


	if (model.provider === 'anthropic') {
		modelName = anthropic(model.value);

		tools = {
			web_search: anthropic.tools.webSearch_20250305({}),
		};

		if (reasoningEffort === 'none') {
			providerOptions = {
				anthropic: {
					thinking: { type: 'disabled' },
				} satisfies AnthropicProviderOptions,
			};
		} else {
			let budgetTokens = 0;

			if (reasoningEffort === 'low') {
				budgetTokens = 6000;
			}

			if (reasoningEffort === 'medium') {
				budgetTokens = 12000;
			}

			if (reasoningEffort === 'high') {
				budgetTokens = 24000;
			}

			providerOptions = {
				anthropic: {
					thinking: { type: 'enabled', budgetTokens },
				} satisfies AnthropicProviderOptions,
			};
		}
	} else if (model.provider === 'google') {
		modelName = google(model.value);

		tools = {
			google_search: google.tools.googleSearch({}),
		};

		providerOptions = {
			google: {
				thinkingConfig: {
					thinkingLevel: reasoningEffort,
						includeThoughts: true,
				},
			} satisfies GoogleGenerativeAIProviderOptions,
		};
	} else {
		modelName = openai.responses(model.value);

		if (!(reasoningEffort === 'none' && model.value === 'gpt-5-mini')) {
			tools = {
				web_search: openai.tools.webSearch({
					searchContextSize: 'high',
					userLocation: {
						type: 'approximate',
					},
				}),
			};
		}

		providerOptions = {
			openai: {
				reasoningEffort: reasoningEffort === 'none' && model.value === 'gpt-5-mini'
					? 'minimal'
					: reasoningEffort,
				textVerbosity,
				include: ['reasoning.encrypted_content'], // Hence, we need to retrieve the model's encrypted reasoning to be able to pass it to follow-up requests
				store: false, // No data retention - makes interaction stateless
				reasoningSummary: 'auto', // output reasoning
			} satisfies OpenAIResponsesProviderOptions
		};
	}

	try {
		const result: StreamTextResult<any, any> = streamText({
			model: modelName,
			messages: await convertToModelMessages(messages),
			system: `When presenting any code examples or data tables, always use Markdown code fences.
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
Do not propose next steps or additional topics unless they are strictly required to answer the question.`,
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
			}
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		if (error instanceof Error) {
			return new Response("Server error: " + error.message, {
				status: 500,
				headers: { 'Content-Type': 'text/plain' }
			});
		} else {
			return new Response("Server error: unknown error", {
				status: 500,
				headers: { 'Content-Type': 'text/plain' }
			});
		}
	}
}
