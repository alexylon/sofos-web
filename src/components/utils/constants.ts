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

export const DEVICE_ID_HEADER = 'x-device-id';

export const models: Model[] = [
	{
		value: 'gpt-5.6-sol',
		label: 'GPT-5.6 Sol',
		provider: Provider.OpenAI,
		type: ModelType.REASONING,
	},
	{
		value: 'gpt-5.6-terra',
		label: 'GPT-5.6 Terra',
		provider: Provider.OpenAI,
		type: ModelType.REASONING,
	},
	{
		value: 'gpt-5.6-luna',
		label: 'GPT-5.6 Luna',
		provider: Provider.OpenAI,
		type: ModelType.REASONING,
	},
	{
		value: 'claude-fable-5',
		label: 'Claude Fable 5',
		provider: Provider.Anthropic,
		type: ModelType.REASONING,
	},
	{
		value: 'claude-opus-4-8',
		label: 'Claude Opus 4.8',
		provider: Provider.Anthropic,
		type: ModelType.REASONING,
	},
	{
		value: 'claude-sonnet-5',
		label: 'Claude Sonnet 5',
		provider: Provider.Anthropic,
		type: ModelType.REASONING,
	}, {
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
	{ value: 'xhigh', label: 'xHigh' },
	{ value: 'max', label: 'Max' },
];

export const getReasoningEfforts = (hasNoneEffort: boolean): ReasoningEffort[] => {
	return hasNoneEffort ? reasoningEfforts : reasoningEfforts.slice(1);
};

export const textVerbosities: TextVerbosity[] = [
	{ value: 'low', label: 'Short' },
	{ value: 'medium', label: 'Normal' },
	{ value: 'high', label: 'Long' },
];
