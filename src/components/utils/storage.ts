import type { UIMessage } from '@ai-sdk/react';
import { StoredUIMessage } from '@/types/types';
import { STORAGE_KEYS } from '@/components/utils/constants';
import { indexedDBStorage } from '@/components/utils/indexedDBStorage';

type MessageWithOptionalAttachments = UIMessage & { experimental_attachments?: unknown };

export const sanitizeChatHistory = (history: UIMessage[][]): UIMessage[][] =>
	history
		.filter((chat): chat is UIMessage[] => Array.isArray(chat))
		.map(chat =>
			chat
				.filter((message): message is UIMessage => Boolean(message))
				.map(message => {
					const sanitizedMessage = { ...message } as MessageWithOptionalAttachments;

					if (sanitizedMessage.experimental_attachments) {
						sanitizedMessage.experimental_attachments = undefined;
					}

					return sanitizedMessage;
				})
		);

export const saveChatHistoryToStorage = async (chatHistory: UIMessage[][]): Promise<void> => {
	if (!chatHistory) return;

	const sanitizedChatHistory = sanitizeChatHistory(chatHistory);

	try {
		await indexedDBStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, sanitizedChatHistory);
	} catch (error) {
		console.error('Error saving chat history to IndexedDB:', error);
	}
};

export const saveModel = (modelValue: string): void => {
	void indexedDBStorage.setItem(STORAGE_KEYS.MODEL, modelValue);
};

export const saveReasoningEffort = (value: string): void => {
	void indexedDBStorage.setItem(STORAGE_KEYS.REASONING_EFFORT, value);
};

export const saveTextVerbosity = (value: string): void => {
	void indexedDBStorage.setItem(STORAGE_KEYS.TEXT_VERBOSITY, value);
};

export const saveCurrentChatIndex = (index: number): void => {
	void indexedDBStorage.setItem(STORAGE_KEYS.CURRENT_CHAT_INDEX, index);
};

export interface PersistedState {
	model: string | null;
	reasoningEffort: string | null;
	textVerbosity: string | null;
	chatHistory: StoredUIMessage[][] | null;
	currentChatIndex: number | null;
}

export const loadPersistedState = async (): Promise<PersistedState> => {
	const [model, reasoningEffort, textVerbosity, chatHistory, currentChatIndex] = await Promise.all([
		indexedDBStorage.getItem<string>(STORAGE_KEYS.MODEL),
		indexedDBStorage.getItem<string>(STORAGE_KEYS.REASONING_EFFORT),
		indexedDBStorage.getItem<string>(STORAGE_KEYS.TEXT_VERBOSITY),
		indexedDBStorage.getItem<StoredUIMessage[][]>(STORAGE_KEYS.CHAT_HISTORY),
		indexedDBStorage.getItem<number>(STORAGE_KEYS.CURRENT_CHAT_INDEX),
	]);

	return { model, reasoningEffort, textVerbosity, chatHistory, currentChatIndex };
};
