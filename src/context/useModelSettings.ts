import { useCallback, useEffect, useMemo, useState } from 'react';
import { SelectChangeEvent } from '@mui/material/Select';
import {
	getReasoningEfforts,
	models,
	textVerbosities,
} from '@/components/utils/constants';
import {
	saveModel,
	saveReasoningEffort,
	saveTextVerbosity,
} from '@/components/utils/storage';
import {
	Model,
	ReasoningEffort,
	ReasoningEffortValue,
	TextVerbosityValue,
} from '@/types/types';

export interface ModelSettingsApi {
	model: Model;
	reasoningEffort: ReasoningEffortValue;
	textVerbosity: TextVerbosityValue;
	updatedReasoningEfforts: ReasoningEffort[];
	setModel: React.Dispatch<React.SetStateAction<Model>>;
	setReasoningEffort: React.Dispatch<React.SetStateAction<ReasoningEffortValue>>;
	setTextVerbosity: React.Dispatch<React.SetStateAction<TextVerbosityValue>>;
	handleModelChange: (event: SelectChangeEvent<string | number>) => void;
	handleReasoningEffortChange: (event: SelectChangeEvent<string | number>) => void;
	handleTextVerbosityChange: (event: SelectChangeEvent<string | number>) => void;
}

const isOpenAI = (modelValue: string) => modelValue.startsWith('o');
const isGemini = (modelValue: string) => modelValue.startsWith('gemini');
const isCodex = (modelValue: string) => modelValue.includes('codex');

export const useModelSettings = (): ModelSettingsApi => {
	const [model, setModel] = useState<Model>(models[0]);

	const hasNoneEffort = useMemo(
		() => !isCodex(model.value) && !isGemini(model.value),
		[model.value],
	);

	const updatedReasoningEfforts = useMemo(
		() => getReasoningEfforts(hasNoneEffort),
		[hasNoneEffort],
	);

	const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffortValue>(
		updatedReasoningEfforts[0].value,
	);
	const [textVerbosity, setTextVerbosity] = useState<TextVerbosityValue>(
		textVerbosities[1].value,
	);

	useEffect(() => {
		const availableEffortValues = updatedReasoningEfforts.map(effort => effort.value);

		if (!availableEffortValues.includes(reasoningEffort)) {
			const next = updatedReasoningEfforts[0].value;
			setReasoningEffort(next);
			saveReasoningEffort(next);
		}
	}, [updatedReasoningEfforts, reasoningEffort]);

	const handleModelChange = useCallback((event: SelectChangeEvent<string | number>) => {
		const valueStr = String(event.target.value);
		const selectedModel = models.find(m => m.value === valueStr);

		if (!selectedModel) return;

		setModel(selectedModel);
		saveModel(valueStr);

		if ((isOpenAI(valueStr) || isGemini(valueStr)) && reasoningEffort === 'none') {
			const next: ReasoningEffortValue = 'low';
			setReasoningEffort(next);
			saveReasoningEffort(next);
		}
	}, [reasoningEffort]);

	const handleReasoningEffortChange = useCallback((event: SelectChangeEvent<string | number>) => {
		const valueStr = String(event.target.value) as ReasoningEffortValue;
		setReasoningEffort(valueStr);
		saveReasoningEffort(valueStr);
	}, []);

	const handleTextVerbosityChange = useCallback((event: SelectChangeEvent<string | number>) => {
		const valueStr = String(event.target.value) as TextVerbosityValue;
		setTextVerbosity(valueStr);
		saveTextVerbosity(valueStr);
	}, []);

	return {
		model,
		reasoningEffort,
		textVerbosity,
		updatedReasoningEfforts,
		setModel,
		setReasoningEffort,
		setTextVerbosity,
		handleModelChange,
		handleReasoningEffortChange,
		handleTextVerbosityChange,
	};
};
