import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

let warnedUnset = false;

// Matched by numeric id, not username: a username can be changed and then taken
// by someone else, but the id never changes.
export function isAllowedGithubUser(githubUserId: string | undefined): boolean {
	const allowedId = process.env.ALLOWED_GITHUB_USER_ID?.trim();

	if (!allowedId) {
		if (!warnedUnset) {
			warnedUnset = true;
			console.error('ALLOWED_GITHUB_USER_ID is not set, so nobody can sign in or use the API');
		}
		return false;
	}

	return githubUserId === allowedId;
}

// Every API route except NextAuth's own must call this first; proxy.ts repeats
// the check in case a route forgets. `token.sub` is the GitHub id of the account
// the session belongs to.
export async function requireAllowedUser(req: NextRequest): Promise<Response | null> {
	const token = await getToken({ req });
	return isAllowedGithubUser(token?.sub) ? null : new Response('Unauthorized', { status: 401 });
}
