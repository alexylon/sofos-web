'use client';

import React, { useEffect, useRef } from 'react';
import { getSession, SessionProvider, useSession } from 'next-auth/react';

// Recheck offsets (ms); the network can take a few seconds to return after foregrounding.
const SESSION_RECOVERY_RETRY_MS = [0, 1000, 4000];

// With the focus refetch off, nothing else re-issues the JWT cookie, so roll it
// at most once a day while the app is used.
const SESSION_KEEP_ALIVE_MS = 24 * 60 * 60 * 1000;

// After a failed session fetch nulls its session, next-auth v4 skips all further
// refetches, leaving the app stuck on the login screen until a full reload. Its
// storage-event channel still forces one, but storage events never fire in the
// tab that writes them, so dispatch one synthetically. Key and payload shape
// verified against next-auth 4.24.14; recheck on upgrade.
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

// Rechecks a "logged out" verdict on load, on each foreground, and when the
// network returns: success means the cookie is valid and an earlier fetch merely
// failed, so force a refetch; a genuinely logged-out user gets null and keeps
// the login screen. Each event replaces the pending burst, and the first success
// stops the rest.
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

// Rolls the JWT cookie for a PWA that is foregrounded for weeks without a
// reload, where it would otherwise silently expire at maxAge. Pings the session
// endpoint at most daily; a failed ping never touches provider state, so unlike
// the focus refetch it cannot flip the UI to the login screen.
const SessionKeepAlive: React.FC = () => {
	const { status } = useSession();
	// The mount fetch just rolled the cookie.
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

// Focus refetch is off: on iOS PWA resume the network is often not back yet, so
// the refetch fails and next-auth drops the session with no retry. SessionRecovery
// covers a failed initial fetch after iOS reloads the page; SessionKeepAlive
// takes over the cookie refresh the focus refetch used to provide.
export const NextAuthProvider: React.FC<NextAuthProviderProps> = ({ children }) => {
	return (
		<SessionProvider refetchOnWindowFocus={false}>
			<SessionRecovery />
			<SessionKeepAlive />
			{children}
		</SessionProvider>
	);
};
