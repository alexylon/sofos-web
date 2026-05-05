import { convertToModelMessages, streamText } from 'ai';
import { buildProviderConfig } from './providers';

export const maxDuration = 60;

export async function POST(req: Request) {
	const { messages, model, reasoningEffort, textVerbosity, id: chatId } = await req.json();
	const promptMessages = await convertToModelMessages(messages);

	const config = buildProviderConfig(model.provider, {
		modelValue: model.value,
		reasoningEffort,
		textVerbosity,
		chatId,
		promptMessages,
	});

	try {
		const result = streamText({
			model: config.modelName,
			messages: config.promptMessages,
			system: config.systemPrompt,
			providerOptions: config.providerOptions,
			tools: config.tools,
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
