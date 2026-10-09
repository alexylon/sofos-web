'use client';

import React, { useEffect, useRef } from 'react';
import { getSession, SessionProvider, useSession } from 'next-auth/react';

// Retry times (ms): the network can take a few seconds to come back after the app reopens.
const SESSION_RECOVERY_RETRY_MS = [0, 1000, 4000];

// Refresh the session cookie at most once a day while the app is in use; with
// refetch-on-focus turned off, nothing else does.
const SESSION_KEEP_ALIVE_MS = 24 * 60 * 60 * 1000;

// After one failed session check, next-auth v4 stops checking, and the app stays
// on the login screen until a full reload. A storage event makes it check again,
// but browsers don't send that event to the tab that caused it, so we send one
// ourselves. Event key and format checked against next-auth 4.24.14; recheck
// when upgrading.
const forceSessionRefetch = (): void => {
	window.dispatchEvent(new StorageEvent('storage', {
		key: 'nextauth.message',
		newValue: JSON.stringify({
			event: 'session',
			data: { trigger: 'getSession' },
			timestamp: Math.floor(Date.now() / 1000),
		}),
	}));
};

// Double-checks a "logged out" result on load, when the app reopens, and when
// the network comes back. If the session is in fact valid, force a new check; a
// user who really is logged out stays on the login screen. Each event restarts
// the retries, and the first success stops them.
const SessionRecovery: React.FC = () => {
	const { status } = useSession();

	useEffect(() => {
		if (status !== 'unauthenticated') return;

		let cancelled = false;
		let recovered = false;
		const timers: ReturnType<typeof setTimeout>[] = [];

		const recover = () => {
			if (document.visibilityState !== 'visible') return;

			timers.forEach(clearTimeout);
			timers.length = 0;

			SESSION_RECOVERY_RETRY_MS.forEach(delay => timers.push(setTimeout(async () => {
				if (cancelled || recovered) return;

				const session = await getSession();
				if (cancelled || recovered || !session) return;

				recovered = true;
				forceSessionRefetch();
			}, delay)));
		};

		recover();
		document.addEventListener('visibilitychange', recover);
		window.addEventListener('pageshow', recover);
		window.addEventListener('online', recover);

		return () => {
			cancelled = true;
			timers.forEach(clearTimeout);
			document.removeEventListener('visibilitychange', recover);
			window.removeEventListener('pageshow', recover);
			window.removeEventListener('online', recover);
		};
	}, [status]);

	return null;
};

// Keeps the session cookie fresh when the PWA stays open for weeks without a
// reload, where it would otherwise expire. Checks the session at most once a day;
// a failed check changes nothing, so unlike refetch-on-focus it can't send the
// user to the login screen.
const SessionKeepAlive: React.FC = () => {
	const { status } = useSession();
	// The session check on page load just refreshed the cookie.
	const lastPingRef = useRef(Date.now());

	useEffect(() => {
		if (status !== 'authenticated') return;

		const ping = () => {
			if (document.visibilityState !== 'visible') return;
			if (Date.now() - lastPingRef.current < SESSION_KEEP_ALIVE_MS) return;

			void getSession({ broadcast: false }).then(session => {
				if (session) lastPingRef.current = Date.now();
			});
		};

		ping();
		document.addEventListener('visibilitychange', ping);
		window.addEventListener('pageshow', ping);

		return () => {
			document.removeEventListener('visibilitychange', ping);
			window.removeEventListener('pageshow', ping);
		};
	}, [status]);

	return null;
};

interface NextAuthProviderProps {
	children?: React.ReactNode;
}

// Refetch-on-focus is off: when the iOS PWA reopens, the network often isn't back
// yet, so the check fails and next-auth drops the session without retrying.
// SessionRecovery handles a failed check after iOS reloads the page, and
// SessionKeepAlive takes over keeping the cookie fresh.
export const NextAuthProvider: React.FC<NextAuthProviderProps> = ({ children }) => {
	return (
		<SessionProvider refetchOnWindowFocus={false}>
			<SessionRecovery />
			<SessionKeepAlive />
			{children}
		</SessionProvider>
	);
};
