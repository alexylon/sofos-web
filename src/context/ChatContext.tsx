'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { SelectChangeEvent } from '@mui/material/Select';
import { Model, ReasoningEffort, ReasoningEffortValue, Status, TextVerbosityValue } from '@/types/types';
import { useFileUploads } from '@/context/useFileUploads';
import { useModelSettings } from '@/context/useModelSettings';
import { useChatPersistence } from '@/context/useChatPersistence';
import { DEVICE_ID_HEADER } from '@/components/utils/constants';
import {
	clearActiveChatId,
	getActiveChatId,
	getOrCreateDeviceId,
	newChatId,
	setActiveChatId,
} from '@/components/utils/resumeStorage';

const STREAM_THROTTLE_MS = 100;
const SCROLL_BOTTOM_OFFSET_RATIO = 0.6;
// After the app reopens, a dropped request can take a moment to fail; check for
// the error at these times (ms) before giving up on resuming.
const STREAM_RESUME_RETRY_MS = [150, 600, 1500];

interface ChatContextType {
	model: Model;
	reasoningEffort: ReasoningEffortValue;
	textVerbosity: TextVerbosityValue;
	images: File[];
	files: File[];
	chatHistory: UIMessage[][];
	currentChatIndex: number;
	jevKey: number;
	open: boolean;
	input: string;
	messages: UIMessage[];
	status: string;
	error?: Error;
	isLoading: boolean;
	isDisabled: boolean;
	hasImages: boolean;
	hasFiles: boolean;
	updatedReasoningEfforts: ReasoningEffort[];
	messagesEndRef: React.RefObject<HTMLDivElement>;
	scrollContainerRef: React.RefObject<HTMLDivElement>;

	setModel: React.Dispatch<React.SetStateAction<Model>>;
	setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
	setChatHistory: React.Dispatch<React.SetStateAction<UIMessage[][]>>;
	setCurrentChatIndex: React.Dispatch<React.SetStateAction<number>>;
	setInput: React.Dispatch<React.SetStateAction<string>>;

	loadChat: (messages: UIMessage[]) => void;
	handleModelChange: (event: SelectChangeEvent<string | number>) => void;
	handleReasoningEffortChange: (event: SelectChangeEvent<string | number>) => void;
	handleTextVerbosityChange: (event: SelectChangeEvent<string | number>) => void;
	handleDrawerOpen: () => void;
	handleDrawerClose: () => void;
	handleStartNewChat: () => void;
	handleClearJev: () => void;
	handleFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
	handleRemoveImage: (index: number) => void;
	handleRemoveFile: (index: number) => void;
	onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	scrollToBottom: () => void;
	saveChatHistory: (history: UIMessage[][]) => void;

	regenerate: () => void;
	stop: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
	const context = useContext(ChatContext);
	if (!context) {
		throw new Error('useChatContext must be used within ChatProvider');
	}
	return context;
};

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const fileUploads = useFileUploads();
	const modelSettings = useModelSettings();

	const [open, setOpen] = useState(false);
	const [input, setInput] = useState('');
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Starts as the id of a chat whose answer a reload interrupted, so the answer
	// can be resumed, or else a new id. Kept in state so switching chats replaces
	// the useChat instance, and an answer still arriving can't change the newly
	// selected chat.
	const [chatId, setChatId] = useState<string>(() => getActiveChatId() ?? newChatId());
	const pendingSessionMessagesRef = useRef<UIMessage[] | null>(null);

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: '/api/use-stream-text',
				// Lets the server check that this device started the answer it resumes.
				headers: (): Record<string, string> => {
					const deviceId = getOrCreateDeviceId();
					return deviceId ? { [DEVICE_ID_HEADER]: deviceId } : {};
				},
				prepareReconnectToStreamRequest: ({ id, api }) => ({
					api: `${api}?chatId=${encodeURIComponent(id)}`,
				}),
			}),
		[],
	);

	const {
		status,
		messages,
		sendMessage,
		setMessages,
		regenerate,
		stop,
		error,
		resumeStream,
		clearError,
	} = useChat({
		id: chatId,
		messages: pendingSessionMessagesRef.current ?? undefined,
		transport,
		// Keep the active chat id while the answer might still be resumable. iOS
		// reports going to the background as either an error or a disconnect, so
		// both keep it; a normal finish or a user stop clears it.
		onFinish: ({ message, isAbort, isDisconnect, isError }) => {
			if (!isError && !isDisconnect) clearActiveChatId();
			persistence.onFinishCallback(message, { isAbort, isDisconnect, isError });
		},
		experimental_throttle: STREAM_THROTTLE_MS,
	});

	const persistence = useChatPersistence({
		setMessages,
		setModel: modelSettings.setModel,
		setReasoningEffort: modelSettings.setReasoningEffort,
		setTextVerbosity: modelSettings.setTextVerbosity,
	});
	const { persistOptimistic, isLoaded } = persistence;

	const isLoading = status === Status.SUBMITTED || status === Status.STREAMING;
	const isDisabled = isLoading || !!error;

	// Set when this page starts an answer, so we only reconnect to answers this
	// page started, never after a fresh page load.
	const inFlightRef = useRef(false);
	const prevStatusRef = useRef(status);

	// Hides the connection error while the resume checks run after the app
	// reopens, so it doesn't flash before the answer is restored.
	const [resumePending, setResumePending] = useState(false);
	const resumeAttemptRef = useRef(0);

	useEffect(() => {
		if (status === Status.READY
			&& (prevStatusRef.current === Status.STREAMING || prevStatusRef.current === Status.SUBMITTED)) {
			inFlightRef.current = false;
		}

		prevStatusRef.current = status;
	}, [status]);

	useEffect(() => {
		const pendingMessages = pendingSessionMessagesRef.current;
		if (!pendingMessages) return;

		pendingSessionMessagesRef.current = null;
		setMessages(pendingMessages);
	}, [chatId, setMessages]);

	const resetChatSession = useCallback((nextMessages: UIMessage[]) => {
		void stop();
		clearError();
		clearActiveChatId();
		inFlightRef.current = false;
		resumeAttemptRef.current++;
		setResumePending(false);
		pendingSessionMessagesRef.current = nextMessages;
		setChatId(newChatId());
	}, [clearError, stop]);

	// Latest error, for the delayed resume checks below.
	const errorRef = useRef(error);
	useEffect(() => {
		errorRef.current = error;
	}, [error]);

	const triggerResume = useCallback(() => {
		clearError();
		resumeStream();
	}, [clearError, resumeStream]);

	// iOS cuts the connection when the PWA goes to the background. When the app
	// reopens and the dropped request shows up as an error, rebuild the answer from
	// the server's copy, removing the partial answer first so it isn't duplicated.
	// Running only when the app reopens leaves working connections and real errors
	// alone, and stops a replayed error from retrying forever. The attempt counter
	// cancels checks left over from an earlier reopen.
	useEffect(() => {
		const onForeground = () => {
			if (document.visibilityState !== 'visible') return;
			if (!inFlightRef.current || !getActiveChatId()) return;

			const attempt = ++resumeAttemptRef.current;
			let handled = false;
			let remaining = STREAM_RESUME_RETRY_MS.length;
			setResumePending(true);

			STREAM_RESUME_RETRY_MS.forEach(delay => setTimeout(() => {
				if (handled || attempt !== resumeAttemptRef.current) return;
				remaining--;

				const canResume = document.visibilityState === 'visible'
					&& errorRef.current && inFlightRef.current && getActiveChatId();

				if (!canResume) {
					if (remaining === 0) setResumePending(false);
					return;
				}

				handled = true;
				setResumePending(false);
				setMessages(prev =>
					prev.length > 0 && prev[prev.length - 1].role === 'assistant' ? prev.slice(0, -1) : prev,
				);
				triggerResume();
			}, delay));
		};

		document.addEventListener('visibilitychange', onForeground);
		window.addEventListener('pageshow', onForeground);

		return () => {
			document.removeEventListener('visibilitychange', onForeground);
			window.removeEventListener('pageshow', onForeground);
		};
	}, [setMessages, triggerResume]);

	// Save the chat as soon as the user's message is added, so it survives a
	// reload mid-answer. Waits for isLoaded so it can't overwrite history before it
	// finishes loading, and checks inFlightRef so a restored chat isn't saved again.
	useEffect(() => {
		if (!isLoaded || !inFlightRef.current) return;
		if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return;
		persistOptimistic(messages);
	}, [messages, isLoaded, persistOptimistic]);

	// After a reload, resume an interrupted answer once its messages are restored.
	const didResumeRef = useRef(false);
	useEffect(() => {
		if (!isLoaded || didResumeRef.current) return;
		didResumeRef.current = true;
		if (!getActiveChatId()) return;
		inFlightRef.current = true;
		triggerResume();
	}, [isLoaded, triggerResume]);

	const handleDrawerOpen = useCallback(() => setOpen(true), []);
	const handleDrawerClose = useCallback(() => setOpen(false), []);
	const handleStartNewChat = useCallback(() => {
		resetChatSession([]);
		persistence.handleStartNewChat();
	}, [persistence, resetChatSession]);

	// Used as the Jev screen's key. Changing it remounts the screen, which clears
	// the form and the answer, including one still loading. The chat is untouched.
	const [jevKey, setJevKey] = useState(0);
	const handleClearJev = useCallback(() => setJevKey(key => key + 1), []);

	const loadChat = useCallback((nextMessages: UIMessage[]) => {
		resetChatSession(nextMessages);
	}, [resetChatSession]);

	const scrollToBottom = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const offsetHeight = (typeof window !== 'undefined' ? window.innerHeight : 0) * SCROLL_BOTTOM_OFFSET_RATIO;
		container.scrollTo({
			top: container.scrollHeight - container.clientHeight - offsetHeight,
			behavior: 'smooth',
		});
	}, []);

	const { images, files, setImages, setFiles } = fileUploads;
	const { model, reasoningEffort, textVerbosity } = modelSettings;

	// Marks an answer as in progress. Both are set together so the app can
	// reconnect to it after a reload or after being in the background.
	const markInFlight = useCallback(() => {
		inFlightRef.current = true;
		setActiveChatId(chatId);
	}, [chatId]);

	const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const allFiles = [...images, ...files];
		const dataTransfer = new DataTransfer();
		allFiles.forEach(file => dataTransfer.items.add(file));
		const fileList = dataTransfer.files;

		const messageOptions = {
			body: { model, reasoningEffort, textVerbosity },
		};

		const messageData = fileList?.length > 0
			? { text: input, files: fileList }
			: { text: input };

		markInFlight();
		sendMessage(messageData, messageOptions).then();
		setInput('');
		setImages([]);
		setFiles([]);
	}, [input, images, files, model, reasoningEffort, textVerbosity, sendMessage, setImages, setFiles, markInFlight]);

	const handleRegenerate = useCallback(() => {
		markInFlight();
		regenerate().then();
	}, [regenerate, markInFlight]);

	const value: ChatContextType = {
		model: modelSettings.model,
		reasoningEffort: modelSettings.reasoningEffort,
		textVerbosity: modelSettings.textVerbosity,
		images: fileUploads.images,
		files: fileUploads.files,
		chatHistory: persistence.chatHistory,
		currentChatIndex: persistence.currentChatIndex,
		jevKey,
		open,
		input,
		messages,
		status,
		// Hidden only for display; isDisabled above still uses the raw error.
		error: resumePending ? undefined : error,
		isLoading,
		isDisabled,
		hasImages: fileUploads.hasImages,
		hasFiles: fileUploads.hasFiles,
		updatedReasoningEfforts: modelSettings.updatedReasoningEfforts,
		messagesEndRef,
		scrollContainerRef,
		setModel: modelSettings.setModel,
		setMessages,
		setChatHistory: persistence.setChatHistory,
		setCurrentChatIndex: persistence.setCurrentChatIndex,
		setInput,
		loadChat,
		handleModelChange: modelSettings.handleModelChange,
		handleReasoningEffortChange: modelSettings.handleReasoningEffortChange,
		handleTextVerbosityChange: modelSettings.handleTextVerbosityChange,
		handleDrawerOpen,
		handleDrawerClose,
		handleStartNewChat,
		handleClearJev,
		handleFilesChange: fileUploads.handleFilesChange,
		handleRemoveImage: fileUploads.handleRemoveImage,
		handleRemoveFile: fileUploads.handleRemoveFile,
		onSubmit,
		scrollToBottom,
		saveChatHistory: persistence.saveChatHistory,
		regenerate: handleRegenerate,
		stop,
	};

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};
