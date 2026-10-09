import { convertToModelMessages, createUIMessageStreamResponse, streamText, type UIMessageChunk } from 'ai';
import type { NextRequest } from 'next/server';
import { requireAllowedUser } from '@/app/api/auth/allowedUser';
import { DEVICE_ID_HEADER } from '@/components/utils/constants';
import { buildProviderConfig } from './providers';
import { finishGeneration, publishChunk, registerGeneration, subscribe, type GenerationHandle } from './streamHub';

export const runtime = 'nodejs'; // the stream hub needs a long-running Node process
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
	const denied = await requireAllowedUser(req);
	if (denied) return denied;

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

		// One copy goes to the browser; the other is saved on the server, so the answer
		// keeps generating if the browser disconnects and can be resumed.
		const [clientStream, hubStream] = uiStream.tee();
		const generation = registerGeneration(chatId, deviceId);
		void drainIntoHub(generation, hubStream);

		return createUIMessageStreamResponse({ stream: clientStream });
	} catch (error) {
		const message = error instanceof Error ? `Server error: ${error.message}` : 'Server error: unknown error';
		return new Response(message, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
}

// useChat reconnects here; a 204 tells it there is nothing to resume.
export async function GET(req: NextRequest) {
	const denied = await requireAllowedUser(req);
	if (denied) return denied;

	const chatId = new URL(req.url).searchParams.get('chatId');
	const deviceId = req.headers.get(DEVICE_ID_HEADER) ?? '';
	const stream = chatId ? subscribe(chatId, deviceId) : null;

	if (!stream) {
		return new Response(null, { status: 204 });
	}

	return createUIMessageStreamResponse({ stream });
}

async function drainIntoHub(generation: GenerationHandle, stream: ReadableStream<UIMessageChunk>): Promise<void> {
	const reader = stream.getReader();

	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			publishChunk(generation, value);
		}
	} catch (error) {
		console.error('Stream hub drain error:', error);
	} finally {
		finishGeneration(generation);
		reader.releaseLock();
	}
}
