import { ChangeEvent, FormEvent, KeyboardEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, MenuItem, TextField, useTheme } from '@mui/material';
import JevAnswerPanel from '@/components/jev/JevAnswerPanel';
import OptionFields from '@/components/jev/OptionFields';
import { HIDDEN_SCROLLBAR, SCREEN_HEIGHT } from '@/components/utils/constants';
import { isSendKey } from '@/components/utils/keyboard';
import { useChatContext } from '@/context/ChatContext';
import { useThemeMode } from '@/theme/ThemeProvider';
import { themeColors } from '@/theme/theme';
import { JevAnswer, JevQuestion, JevQuestionType } from '@/types/types';

const QUESTION_TYPES: { value: JevQuestionType; label: string; placeholder: string }[] = [
	{ value: 'noul', label: 'Yes / No', placeholder: 'Is the customer asking for a refund?' },
	{ value: 'choice', label: 'Choice', placeholder: 'Which team should handle this?' },
	{ value: 'score', label: 'Score', placeholder: 'How urgent is this message?' },
];

const TYPE_ITEMS = QUESTION_TYPES.map(option => (
	<MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
));

// TypeSafe's limits per question.
const MAX_OPTIONS = 255;
const MAX_LEVELS = 10;
const SCROLL_MARGIN_PX = 16;

// Memoized so a keystroke re-renders only its own field. Re-rendering every
// field on each keystroke hit React's update limit and dropped keys.
const Field = memo(TextField);

// Safari doesn't open the gap in the border when a label moves up on focus, so
// the border crosses the label. Keeping labels raised from the start avoids it.
const RAISED_LABEL = { inputLabel: { shrink: true } };

interface Asked {
	question: string;
	answer: JevAnswer;
}

type FieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

const filled = (items: string[]) => items.map(item => item.trim()).filter(Boolean);

const submitOnEnter = (event: KeyboardEvent<HTMLDivElement>) => {
	if (!isSendKey(event)) return;
	event.preventDefault();
	(event.target as HTMLTextAreaElement).form?.requestSubmit();
};

export default function JevScreen() {
	const { model } = useChatContext();
	const { mode } = useThemeMode();
	const theme = useTheme();
	const colors = themeColors[mode];

	const [text, setText] = useState('');
	const [type, setType] = useState<JevQuestionType>('noul');
	const [instructions, setInstructions] = useState('');
	const [options, setOptions] = useState(['', '']);
	const [levels, setLevels] = useState(['', '', '']);
	const [asked, setAsked] = useState<Asked | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isAsking, setIsAsking] = useState(false);

	const scrollRef = useRef<HTMLDivElement>(null);
	const resultRef = useRef<HTMLDivElement>(null);

	// Options are sent as object keys, so duplicates would merge into one.
	const criteria = type === 'choice' ? Array.from(new Set(filled(options))) : filled(levels);
	const canAsk = !isAsking && instructions.trim() !== '' && (type === 'noul' || criteria.length >= 2);

	const inputSx = useMemo(
		() => ({ '& .MuiOutlinedInput-root': { backgroundColor: colors.inputBackground } }),
		[colors.inputBackground],
	);

	const typeSx = useMemo(() => ({ ...inputSx, width: { xs: '100%', sm: 132 }, flexShrink: 0 }), [inputSx]);

	const handleTextChange = useCallback((event: FieldChangeEvent) => setText(event.target.value), []);
	const handleInstructionsChange = useCallback((event: FieldChangeEvent) => setInstructions(event.target.value), []);
	const handleTypeChange = useCallback((event: FieldChangeEvent) => setType(event.target.value as JevQuestionType), []);

	// On small screens the form can push a new answer out of view.
	useEffect(() => {
		const container = scrollRef.current;
		const result = resultRef.current;
		if (!container || !result || (!asked && !error)) return;

		const containerBox = container.getBoundingClientRect();
		const resultBox = result.getBoundingClientRect();
		if (resultBox.bottom <= containerBox.bottom) return;

		container.scrollBy({ top: resultBox.top - containerBox.top - SCROLL_MARGIN_PX, behavior: 'smooth' });
	}, [asked, error]);

	const buildQuestion = (): JevQuestion => {
		const question: JevQuestion = { type, instructions: instructions.trim() };

		if (type === 'choice') question.criteria = Object.fromEntries(criteria.map(option => [option, null]));
		if (type === 'score') question.criteria = criteria;

		return question;
	};

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!canAsk) return;

		const question = buildQuestion();
		setIsAsking(true);
		setError(null);

		try {
			const response = await fetch('/api/typesafe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: model.value, state: text.trim(), question }),
			});
			// A proxy timeout returns an HTML page, not JSON.
			const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));

			if (!response.ok || !body?.answer) throw new Error(body?.error || `HTTP ${response.status}`);
			setAsked({ question: question.instructions, answer: body.answer });
		} catch (askError) {
			setError(askError instanceof Error ? askError.message : String(askError));
		} finally {
			setIsAsking(false);
		}
	};

	const placeholder = QUESTION_TYPES.find(option => option.value === type)?.placeholder;

	return (
		<Box
			ref={scrollRef}
			sx={{ mt: '60px', height: SCREEN_HEIGHT, overflowY: 'auto', ...HIDDEN_SCROLLBAR }}
		>
			<Box sx={{ maxWidth: 720, mx: 'auto', px: 2, pt: 2, pb: 8 }}>
				<Box component="form" noValidate onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
					<Field
						label="Text to evaluate (optional)"
						placeholder="Paste a message, document, or record"
						multiline
						minRows={3}
						maxRows={10}
						value={text}
						onChange={handleTextChange}
						slotProps={RAISED_LABEL}
						sx={inputSx}
					/>
					<Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 2, sm: 1 } }}>
						<Field select label="Type" value={type} onChange={handleTypeChange} sx={typeSx}>
							{TYPE_ITEMS}
						</Field>
						<Field
							label="Question"
							placeholder={placeholder}
							multiline
							maxRows={4}
							fullWidth
							value={instructions}
							onChange={handleInstructionsChange}
							onKeyDown={submitOnEnter}
							slotProps={RAISED_LABEL}
							sx={inputSx}
						/>
					</Box>
					{type === 'choice' && (
						<OptionFields
							label="Options"
							itemLabel="Option"
							values={options}
							max={MAX_OPTIONS}
							inputSx={inputSx}
							onChange={setOptions}
						/>
					)}
					{type === 'score' && (
						<OptionFields
							label="Levels, lowest first"
							itemLabel="Level"
							values={levels}
							max={MAX_LEVELS}
							inputSx={inputSx}
							onChange={setLevels}
						/>
					)}
					<Box>
						<Button
							type="submit"
							variant="contained"
							disableElevation
							disabled={!canAsk}
							sx={{ textTransform: 'none' }}
						>
							{isAsking ? 'Asking…' : 'Ask Jev'}
						</Button>
					</Box>
				</Box>
				<Box ref={resultRef} aria-live="polite" sx={{ mt: 3, opacity: isAsking ? 0.5 : 1 }}>
					{error && (
						<Box
							role="alert"
							sx={{ backgroundColor: colors.errorMessage, borderRadius: `${theme.shape.borderRadius}px`, p: 2 }}
						>
							Jev couldn&apos;t answer: {error}
						</Box>
					)}
					{!error && asked && <JevAnswerPanel question={asked.question} answer={asked.answer} />}
				</Box>
			</Box>
		</Box>
	);
}
