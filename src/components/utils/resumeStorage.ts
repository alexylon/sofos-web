// Synchronous client-side storage for stream resume. Read synchronously to build
// a request header and seed useChat's id, so it uses localStorage rather than the
// app's async IndexedDB layer.

const DEVICE_ID_KEY = 'sofos:deviceId';
const ACTIVE_CHAT_ID_KEY = 'sofos:activeChatId';

const randomId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const read = (key: string): string | null => {
	if (typeof window === 'undefined') return null;

	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
};

const write = (key: string, value: string): void => {
	if (typeof window === 'undefined') return;

	try {
		window.localStorage.setItem(key, value);
	} catch {
		// ignore (private mode, quota)
	}
};

const remove = (key: string): void => {
	if (typeof window === 'undefined') return;

	try {
		window.localStorage.removeItem(key);
	} catch {
		// ignore
	}
};

export const newChatId = (): string => randomId();

// Per-device token. Resume is scoped by this, not the shared login.
export const getOrCreateDeviceId = (): string => {
	let id = read(DEVICE_ID_KEY);

	if (!id) {
		id = randomId();
		write(DEVICE_ID_KEY, id);
	}

	return id;
};

// Chat id of an interrupted generation: set on send, cleared when the turn ends
// cleanly, kept across a reload so it can be resumed.
export const getActiveChatId = (): string | null => read(ACTIVE_CHAT_ID_KEY);
export const setActiveChatId = (chatId: string): void => write(ACTIVE_CHAT_ID_KEY, chatId);
export const clearActiveChatId = (): void => remove(ACTIVE_CHAT_ID_KEY);
