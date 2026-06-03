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
// A dropped fetch can take a moment to reject after the app returns; recheck for
// the error at these offsets (ms) before giving up on resuming.
const STREAM_RESUME_RETRY_MS = [150, 600, 1500];

interface ChatContextType {
	model: Model;
	reasoningEffort: ReasoningEffortValue;
	textVerbosity: TextVerbosityValue;
	images: File[];
	files: File[];
	chatHistory: UIMessage[][];
	currentChatIndex: number;
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

	handleModelChange: (event: SelectChangeEvent<string | number>) => void;
	handleReasoningEffortChange: (event: SelectChangeEvent<string | number>) => void;
	handleTextVerbosityChange: (event: SelectChangeEvent<string | number>) => void;
	handleDrawerOpen: () => void;
	handleDrawerClose: () => void;
	handleStartNewChat: () => void;
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

	// Seed from a previous load's interrupted turn so resume targets that
	// generation; otherwise a fresh id.
	const [chatId] = useState<string>(() => getActiveChatId() ?? newChatId());

	const transport = useMemo(
		() =>
			new DefaultChatTransport({
				api: '/api/use-stream-text',
				// Per-device token scopes resume access; the shared login can't.
				headers: (): Record<string, string> => {
					const deviceId = getOrCreateDeviceId();
					return deviceId ? { [DEVICE_ID_HEADER]: deviceId } : {};
				},
				// Reconnect hits the same route as a GET with the chat id.
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
		transport,
		// Keep the active id while a turn might still be resumable (any interrupted
		// stream — iOS reports backgrounding inconsistently as error or disconnect);
		// a clean finish or user abort clears it.
		onFinish: ({ message, isDisconnect, isError }) => {
			if (!isError && !isDisconnect) clearActiveChatId();
			persistence.onFinishCallback(message, { isDisconnect, isError });
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

	// Tracks a turn started in this page session, so we only reconnect to a
	// generation this page actually launched — never on a cold reload.
	const inFlightRef = useRef(false);
	const prevStatusRef = useRef(status);

	useEffect(() => {
		if (status === Status.READY
			&& (prevStatusRef.current === Status.STREAMING || prevStatusRef.current === Status.SUBMITTED)) {
			inFlightRef.current = false;
		}

		prevStatusRef.current = status;
	}, [status]);

	// Latest error, read inside the deferred resume checks below.
	const errorRef = useRef(error);
	useEffect(() => {
		errorRef.current = error;
	}, [error]);

	const triggerResume = useCallback(() => {
		clearError();
		resumeStream();
	}, [clearError, resumeStream]);

	// iOS kills the stream when the PWA is backgrounded. On return, once the dropped
	// fetch surfaces as an error, rebuild from the server buffer — dropping the
	// trailing partial first so the replay doesn't duplicate it. Firing only on a
	// return event leaves a healthy stream and a genuine foreground error untouched,
	// and stops a replayed error looping (no new return means no retry).
	useEffect(() => {
		const onForeground = () => {
			if (document.visibilityState !== 'visible') return;
			if (!inFlightRef.current || !getActiveChatId()) return;

			let handled = false;

			STREAM_RESUME_RETRY_MS.forEach(delay => setTimeout(() => {
				if (handled || document.visibilityState !== 'visible') return;
				if (!errorRef.current || !inFlightRef.current || !getActiveChatId()) return;

				handled = true;
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

	// Persist the turn as soon as the user message lands, so it survives a reload
	// mid-answer. Waits for isLoaded so it can't overwrite history before the async
	// load applies; gated on inFlightRef so a restored chat isn't re-saved on load.
	useEffect(() => {
		if (!isLoaded || !inFlightRef.current) return;
		if (messages.length === 0 || messages[messages.length - 1].role !== 'user') return;
		persistOptimistic(messages);
	}, [messages, isLoaded, persistOptimistic]);

	// After a reload, resume an interrupted turn once its messages are restored.
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

	// Start a resumable turn: both fields move together so a reload or backgrounding
	// can reconnect to it.
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
		open,
		input,
		messages,
		status,
		error,
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
		handleModelChange: modelSettings.handleModelChange,
		handleReasoningEffortChange: modelSettings.handleReasoningEffortChange,
		handleTextVerbosityChange: modelSettings.handleTextVerbosityChange,
		handleDrawerOpen,
		handleDrawerClose,
		handleStartNewChat: persistence.handleStartNewChat,
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
