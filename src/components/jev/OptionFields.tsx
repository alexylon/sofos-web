import { Dispatch, memo, SetStateAction, useCallback, useState } from 'react';
import { Box, Button, IconButton, TextField, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

const MIN_FIELDS = 2;

interface OptionFieldsProps {
	label: string;
	itemLabel: string;
	values: string[];
	max: number;
	inputSx: SxProps<Theme>;
	onChange: Dispatch<SetStateAction<string[]>>;
}

interface OptionRowProps {
	index: number;
	value: string;
	name: string;
	canRemove: boolean;
	autoFocus: boolean;
	inputSx: SxProps<Theme>;
	onUpdate: (index: number, value: string) => void;
	onRemove: (index: number) => void;
}

// Memoized so typing re-renders only the edited row (see Field in JevScreen).
const OptionRow = memo(function OptionRow({
	index,
	value,
	name,
	canRemove,
	autoFocus,
	inputSx,
	onUpdate,
	onRemove,
}: OptionRowProps) {
	return (
		<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
			<TextField
				fullWidth
				size="small"
				autoFocus={autoFocus}
				value={value}
				placeholder={name}
				slotProps={{ htmlInput: { 'aria-label': name } }}
				onChange={event => onUpdate(index, event.target.value)}
				sx={inputSx}
			/>
			{canRemove && (
				<IconButton aria-label={`Remove ${name.toLowerCase()}`} onClick={() => onRemove(index)}>
					<CloseIcon fontSize="small" />
				</IconButton>
			)}
		</Box>
	);
});

function OptionFields({ label, itemLabel, values, max, inputSx, onChange }: OptionFieldsProps) {
	const [addedIndex, setAddedIndex] = useState<number | null>(null);

	const update = useCallback((index: number, value: string) =>
		onChange(prev => prev.map((current, i) => (i === index ? value : current))), [onChange]);

	const remove = useCallback((index: number) =>
		onChange(prev => prev.filter((_, i) => i !== index)), [onChange]);

	const add = () => {
		setAddedIndex(values.length);
		onChange(prev => [...prev, '']);
	};

	return (
		<Box component="fieldset" sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
			<Typography component="legend" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
				{label}
			</Typography>
			<Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
				{values.map((value, index) => (
					<OptionRow
						key={index}
						index={index}
						value={value}
						name={`${itemLabel} ${index + 1}`}
						canRemove={values.length > MIN_FIELDS}
						autoFocus={index === addedIndex}
						inputSx={inputSx}
						onUpdate={update}
						onRemove={remove}
					/>
				))}
			</Box>
			{values.length < max && (
				<Button startIcon={<AddIcon />} onClick={add} sx={{ mt: 1, textTransform: 'none' }}>
					Add {itemLabel.toLowerCase()}
				</Button>
			)}
		</Box>
	);
}

export default memo(OptionFields);
