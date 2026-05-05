import { Model, ModelType, Provider, ReasoningEffort, TextVerbosity } from '@/types/types';

export const MAX_IMAGES = 5;
export const MAX_FILES = 5;
export const MAX_PERSISTED_CHATS = 20;
export const IMAGE_MAX_DIMENSION = 2048;

export const INPUT_FOCUS_DELAY_MS = 100;
export const COPY_FEEDBACK_TIMEOUT_MS = 2000;
export const HINT_AUTO_DISMISS_MS = 5000;

export const PWA_RESUME_RETRY_MS = [100, 500] as const;
export const RECORDING_TIMESLICE_MS = 250;
export const SILENCE_THRESHOLD = 0.01;
export const MAX_KEPT_SILENCE_MS = 2000;
export const INACTIVITY_STOP_MS = 5000;
export const MIN_RECORDING_MS = 1000;
export const SIMPLIFIED_MAX_RECORDING_MS = 30000;
export const SAFETY_MAX_RECORDING_MS = 2 * 60 * 1000;
export const TARGET_SAMPLE_RATE_HZ = 16000;
export const FFT_SIZE = 2048;

export const ICON_SIZE_SM = '26px';
export const ICON_SIZE_MD = '30px';
export const MIC_ICON_SIZE = '24px';
export const CODE_BLOCK_RADIUS = '13px 13px 0 0';

export const STORAGE_KEYS = {
	CHAT_HISTORY: 'sofosChatHistory',
	MODEL: 'sofosModel',
	REASONING_EFFORT: 'sofosReasoningEffort',
	TEXT_VERBOSITY: 'sofosTextVerbosity',
	CURRENT_CHAT_INDEX: 'sofosCurrentChatIndex',
} as const;

export const ANTHROPIC_THINKING_BUDGET: Record<string, number> = {
	low: 6000,
	medium: 12000,
	high: 24000,
};

export const models: Model[] = [
	{
		value: 'gpt-5.5',
		label: 'GPT-5.5',
		provider: Provider.OpenAI,
		type: ModelType.REASONING,
	},
	{
		value: 'gpt-5.3-codex',
		label: 'GPT-5.3 Codex',
		provider: Provider.OpenAI,
		type: ModelType.REASONING,
	},
	{
		value: 'gpt-5-mini',
		label: 'GPT-5 mini',
		provider: Provider.OpenAI,
		type: ModelType.REASONING,
	},
	{
		value: 'claude-sonnet-4-6',
		label: 'Claude Sonnet 4.6',
		provider: Provider.Anthropic,
		type: ModelType.REASONING,
	},
	{
		value: 'claude-opus-4-7',
		label: 'Claude Opus 4.7',
		provider: Provider.Anthropic,
		type: ModelType.REASONING,
	},
	{
		value: 'gemini-3.1-pro-preview',
		label: 'Gemini 3.1 Pro',
		provider: Provider.Google,
		type: ModelType.REASONING,
	},
];

export const reasoningEfforts: ReasoningEffort[] = [
	{ value: 'none', label: 'None' },
	{ value: 'low', label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high', label: 'High' },
];

export const getReasoningEfforts = (hasNoneEffort: boolean): ReasoningEffort[] => {
	return hasNoneEffort ? reasoningEfforts : reasoningEfforts.slice(1);
};

export const textVerbosities: TextVerbosity[] = [
	{ value: 'low', label: 'Short' },
	{ value: 'medium', label: 'Normal' },
	{ value: 'high', label: 'Long' },
];
