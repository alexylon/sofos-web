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
	TypeSafe = "typesafe",
}

export type JevQuestionType = "noul" | "choice" | "score";

export interface JevQuestion {
	type: JevQuestionType;
	instructions: string;
	criteria?: Record<string, null> | string[];
}

export type JevAnswer =
	| { type: "noul"; noul: number }
	| { type: "choice"; choice: string; probabilities: Record<string, number>; confidence: number }
	| {
		type: "score";
		score: number;
		legend: Record<string, string>;
		probabilities: Record<string, number>;
		confidence: number;
	};

export interface ReasoningEffort {
	value: ReasoningEffortValue;
	label: string;
}

export type ReasoningEffortValue = "none" | "low" | "medium" | "high" | "xhigh" | "max";

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
