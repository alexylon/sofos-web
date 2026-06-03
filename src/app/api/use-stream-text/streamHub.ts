import type { UIMessageChunk } from 'ai';

// On iOS, backgrounding the PWA tears down the client's streaming connection,
// which used to abort generation and show an error instead of the reply. This hub
// moves stream ownership to the server: a POST drains the model output into a
// per-chat buffer that runs regardless of the client, and a GET replays and tails
// it on reconnect. Entries are ephemeral and device-scoped, so chat history stays
// client-side; state lives in the single Node process and is lost on restart.

interface HubEntry {
	deviceId: string;
	chunks: UIMessageChunk[];
	done: boolean;
	listeners: Set<(chunk: UIMessageChunk | null) => void>;
	evictTimer?: ReturnType<typeof setTimeout>;
	createdAt: number;
}

const RESUME_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50;

// Survive dev HMR re-evaluation; a single shared instance in production.
const globalForHub = globalThis as unknown as { __sofosStreamHub?: Map<string, HubEntry> };
const store: Map<string, HubEntry> = globalForHub.__sofosStreamHub ?? (globalForHub.__sofosStreamHub = new Map());

const evictIfNeeded = (): void => {
	if (store.size <= MAX_ENTRIES) return;

	let oldestKey: string | undefined;
	let oldestAt = Infinity;

	store.forEach((entry, key) => {
		if (entry.createdAt < oldestAt) {
			oldestAt = entry.createdAt;
			oldestKey = key;
		}
	});

	if (oldestKey) {
		const entry = store.get(oldestKey);
		if (entry?.evictTimer) clearTimeout(entry.evictTimer);
		store.delete(oldestKey);
	}
};

// Overwrites any existing entry so a new turn replaces a stale one.
export const registerGeneration = (chatId: string, deviceId: string): void => {
	const existing = store.get(chatId);
	if (existing?.evictTimer) clearTimeout(existing.evictTimer);

	store.set(chatId, {
		deviceId,
		chunks: [],
		done: false,
		listeners: new Set(),
		createdAt: Date.now(),
	});

	evictIfNeeded();
};

export const publishChunk = (chatId: string, chunk: UIMessageChunk): void => {
	const entry = store.get(chatId);
	if (!entry) return;
	entry.chunks.push(chunk);
	entry.listeners.forEach(listener => listener(chunk));
};

export const finishGeneration = (chatId: string): void => {
	const entry = store.get(chatId);
	if (!entry) return;
	entry.done = true;
	entry.listeners.forEach(listener => listener(null));
	entry.listeners.clear();
	entry.evictTimer = setTimeout(() => store.delete(chatId), RESUME_TTL_MS);
};

// Replays buffered chunks, then tails live ones until done. Null when there is
// nothing to resume or the device token doesn't own the generation.
export const subscribe = (chatId: string, deviceId: string): ReadableStream<UIMessageChunk> | null => {
	const entry = store.get(chatId);
	if (!entry || entry.deviceId !== deviceId) return null;

	let listener: ((chunk: UIMessageChunk | null) => void) | undefined;

	return new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of entry.chunks) {
				try {
					controller.enqueue(chunk);
				} catch {
					return; // consumer already gone
				}
			}

			if (entry.done) {
				try { controller.close(); } catch { /* already closed */ }
				return;
			}

			listener = (chunk) => {
				if (chunk === null) {
					try { controller.close(); } catch { /* already closed */ }
				} else {
					try { controller.enqueue(chunk); } catch { /* closed */ }
				}
			};

			entry.listeners.add(listener);
		},
		cancel() {
			if (listener) entry.listeners.delete(listener);
		},
	});
};
