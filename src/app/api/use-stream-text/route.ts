import { convertToModelMessages, createUIMessageStreamResponse, streamText, type UIMessageChunk } from 'ai';
import { DEVICE_ID_HEADER } from '@/components/utils/constants';
import { buildProviderConfig } from './providers';
import { finishGeneration, publishChunk, registerGeneration, subscribe } from './streamHub';

export const runtime = 'nodejs'; // module-level hub + detached drain need a long-lived process
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
	const { messages, model, reasoningEffort, textVerbosity, id: chatId } = await req.json();
	const deviceId = req.headers.get(DEVICE_ID_HEADER) ?? '';
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

		const uiStream = result.toUIMessageStream();

		if (!chatId) {
			return createUIMessageStreamResponse({ stream: uiStream });
		}

		// One branch streams to the client; the other is drained into the hub.
		// Draining server-side keeps generation alive if the client drops and
		// buffers it for resume.
		const [clientStream, hubStream] = uiStream.tee();
		registerGeneration(chatId, deviceId);
		void drainIntoHub(chatId, hubStream);

		return createUIMessageStreamResponse({ stream: clientStream });
	} catch (error) {
		const message = error instanceof Error ? `Server error: ${error.message}` : 'Server error: unknown error';
		return new Response(message, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
}

// Reconnect endpoint for useChat. 204 means nothing to resume, which the SDK
// treats as a no-op.
export async function GET(req: Request) {
	const chatId = new URL(req.url).searchParams.get('chatId');
	const deviceId = req.headers.get(DEVICE_ID_HEADER) ?? '';
	const stream = chatId ? subscribe(chatId, deviceId) : null;

	if (!stream) {
		return new Response(null, { status: 204 });
	}

	return createUIMessageStreamResponse({ stream });
}

async function drainIntoHub(chatId: string, stream: ReadableStream<UIMessageChunk>): Promise<void> {
	const reader = stream.getReader();

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			publishChunk(chatId, value);
		}
	} catch (error) {
		console.error('Stream hub drain error:', error);
	} finally {
		finishGeneration(chatId);
		reader.releaseLock();
	}
}
