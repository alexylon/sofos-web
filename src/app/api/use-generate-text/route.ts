import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, GenerateTextResult, generateText } from 'ai';

// maxDuration text generation response time is 5 minutes, but on vercel plan hobby it is 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
	// Extract the data from the body of the request
	const { messages, model } = await req.json();

	try {
		const result: GenerateTextResult<any, any> = await generateText({
			model: openai(model.value),
			messages: await convertToModelMessages(messages),
			topP: 0.8,
		});

		return new Response(result.text);
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
