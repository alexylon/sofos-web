import type { UIMessage } from '@ai-sdk/react';

export interface Model {
	value: string;
	label: string;
	provider: Provider;
	type: ModelType;
}

export enum ModelType {
	STANDARD = "STANDARD",
	REASONING = "REASONING",
	HYBRID = "HYBRID",
}

export enum Provider {
	OpenAI = "openai",
	Anthropic = "anthropic",
	Google = "google",
}

export interface ReasoningEffort {
	value: ReasoningEffortValue;
	label: string;
}

export type ReasoningEffortValue = "none" | "low" | "medium" | "high";

export type AnthropicEffortValue = Exclude<ReasoningEffortValue, "none">;

export interface TextVerbosity {
	value: TextVerbosityValue;
	label: string;
}

export type TextVerbosityValue = "low" | "medium" | "high";

export enum Status {
	SUBMITTED = "submitted",
	STREAMING = "streaming",
	READY = "ready",
	ERROR = "error",
}

export type StatusType = `${Status}`;

export type StoredUIMessage = UIMessage & {
	createdAt?: Date;
	modelId?: string;
	name?: string;
};
