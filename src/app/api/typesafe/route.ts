import type { NextRequest } from 'next/server';
import { requireAllowedUser } from '@/app/api/auth/allowedUser';
import type { JevAnswer } from '@/types/types';

const SYSTEM_ONE_URL = 'https://api.typesafe.ai/v1/systemone';
// TypeSafe's docs say to wait and retry these: 429 rate limited, 529 overloaded.
const RETRY_STATUSES = [429, 529];
const RETRY_DELAYS_MS = [300, 1000];
const MAX_RETRY_AFTER_MS = 5000;
// Jev answers in under a second, so this only catches a stalled connection.
const ATTEMPT_TIMEOUT_MS = 15000;

export const maxDuration = 60;

export async function POST(req: NextRequest) {
	const denied = await requireAllowedUser(req);
	if (denied) return denied;

	const request = await req.json().catch(() => null);

	if (!request) {
		return Response.json({ error: 'The request body is not valid JSON' }, { status: 400 });
	}

	const { model, state, question } = request;
	const apiKey = process.env.TYPESAFE_API_KEY;

	if (!apiKey) {
		return Response.json({ error: 'TYPESAFE_API_KEY is not set on the server' }, { status: 500 });
	}

	let response: Response;

	try {
		response = await askSystemOne(apiKey, JSON.stringify({ model, state, questions: { answer: question } }));
	} catch (error) {
		console.error('TypeSafe error:', error);
		return Response.json({ error: `TypeSafe is unreachable: ${describeFailure(error)}` }, { status: 502 });
	}

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		console.error('TypeSafe error:', response.status, body);
		return Response.json(
			{ error: describeError(body) || `TypeSafe answered HTTP ${response.status}` },
			{ status: response.status },
		);
	}

	const body = await response.json().catch(() => null);
	const answer: JevAnswer | undefined = body?.answers?.answer;

	if (!isDrawable(answer, question?.type)) {
		console.error('TypeSafe sent an unexpected response:', body);
		return Response.json({ error: 'TypeSafe sent an unexpected response' }, { status: 502 });
	}

	return Response.json({ answer });
}

// Asking twice has no side effects, so dropped connections and busy responses
// are retried.
async function askSystemOne(apiKey: string, body: string): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		const isLastAttempt = attempt === RETRY_DELAYS_MS.length;

		try {
			const response = await fetch(SYSTEM_ONE_URL, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body,
				signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
			});

			if (isLastAttempt || !RETRY_STATUSES.includes(response.status)) return response;

			await response.body?.cancel();
			await sleep(retryAfterMs(response) ?? RETRY_DELAYS_MS[attempt]);
		} catch (error) {
			if (isLastAttempt) throw error;

			console.warn('TypeSafe request failed, retrying:', error);
			await sleep(RETRY_DELAYS_MS[attempt]);
		}
	}
}

// Capped so a long Retry-After can't hold up the answer.
function retryAfterMs(response: Response): number | undefined {
	const seconds = Number(response.headers.get('retry-after'));
	return seconds > 0 ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS) : undefined;
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// fetch only says "fetch failed"; the real network error is in its cause.
function describeFailure(error: unknown): string {
	if (!(error instanceof Error)) return 'unknown error';
	if (error.name === 'TimeoutError') return `no answer within ${ATTEMPT_TIMEOUT_MS / 1000} seconds`;

	const cause = error.cause instanceof Error ? error.cause.message : undefined;
	return cause ? `${error.message} (${cause})` : error.message;
}

// The screen reads these fields directly; a reply without them would crash it.
function isDrawable(answer: JevAnswer | undefined, type: string | undefined): answer is JevAnswer {
	if (!answer || answer.type !== type) return false;

	switch (answer.type) {
		case 'noul':
			return typeof answer.noul === 'number';
		case 'choice':
			return typeof answer.choice === 'string' && isRecord(answer.probabilities)
				&& typeof answer.confidence === 'number';
		case 'score':
			return typeof answer.score === 'number' && isRecord(answer.legend) && isRecord(answer.probabilities)
				&& typeof answer.confidence === 'number';
	}
}

function isRecord(value: unknown): boolean {
	return typeof value === 'object' && value !== null;
}

// TypeSafe's error detail is a message, a list of invalid fields, or an object
// with a message. Anything else returns '' so the caller shows the HTTP status.
function describeError(body: string): string {
	try {
		const { detail } = JSON.parse(body);

		if (typeof detail === 'string') return detail;

		if (Array.isArray(detail)) {
			return (detail as { loc: string[]; msg: string }[])
				.map(({ loc, msg }) => `${loc.slice(1).join('.')}: ${msg}`)
				.join('; ');
		}

		return typeof detail?.message === 'string' ? detail.message : '';
	} catch {
		// Not JSON, such as an HTML error page from the proxy in front of TypeSafe.
		return '';
	}
}
