import { NextResponse, type NextRequest } from 'next/server';
import { requireAllowedUser } from '@/app/api/auth/allowedUser';

// Repeats each API route's own check, so a route that forgets it is still
// protected. The routes keep their own check because checks made only here have
// been bypassed before (CVE-2025-29927).
export async function proxy(req: NextRequest) {
	return (await requireAllowedUser(req)) ?? NextResponse.next();
}

export const config = {
	// All of /api except next-auth's own endpoints, which sign-in needs. List
	// checked against next-auth 4.24.14; recheck when upgrading.
	matcher: '/api/((?!auth/(?:providers|session|csrf|signin|signout|callback|verify-request|error|_log)(?:/|$)).*)',
};
