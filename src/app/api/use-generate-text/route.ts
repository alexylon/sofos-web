import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, generateText } from 'ai';
import type { NextRequest } from 'next/server';
import { requireAllowedUser } from '@/app/api/auth/allowedUser';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
	const denied = await requireAllowedUser(req);
	if (denied) return denied;

	const { messages, model } = await req.json();

	try {
		const result = await generateText({
			model: openai(model.value),
			messages: await convertToModelMessages(messages),
			topP: 0.8,
		});

		return new Response(result.text);
	} catch (error) {
		const message = error instanceof Error
			? `Server error: ${error.message}`
			: 'Server error: unknown error';

		return new Response(message, {
			status: 500,
			headers: { 'Content-Type': 'text/plain' },
		});
	}
}
