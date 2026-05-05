import * as React from 'react';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import { Model, ReasoningEffort, TextVerbosity } from '@/types/types';
import { useTheme } from '@mui/material';

type SelectOption = Model | ReasoningEffort | TextVerbosity;

interface SelectSmallProps {
	options: readonly SelectOption[];
	handleChange: (event: SelectChangeEvent<string | number>) => void;
	value: string | number;
	style?: React.CSSProperties;
	disabled?: boolean;
}

export default function SelectSmall({ options, handleChange, value, style, disabled }: SelectSmallProps) {
	const theme = useTheme();

	return (
		<FormControl size="small">
			<Select
				labelId="select-small-label"
				id="select-small"
				value={value}
				label="label"
				onChange={handleChange}
				variant="standard"
				style={style}
				disabled={disabled}
				sx={{
					'&:before': {
						borderBottom: 'none',
					},
					'&:hover:not(.Mui-disabled):before': {
						borderBottom: 'none',
					},
					'& .MuiSelect-select': {
						color: 'white',
					},
					'& .MuiSelect-select.Mui-selected': {
						color: 'white',
					},
					'& .MuiSelect-select:hover': {
						color: 'white',
					},
					'& .MuiSelect-icon': {
						color: 'white',
						right: '2px',
					},
					'&.Mui-disabled': {
						'& .MuiSelect-select': {
							color: 'grey',
						},
						'& .MuiSelect-icon': {
							display: 'none',
						},
						'&:before': {
							borderBottom: 'none',
						},
					},
					'&.MuiInputBase-root.MuiSelect-root': {
						'&:after': {
							borderBottom: 'none',
						},
					},
				}}
				MenuProps={{
					sx: {
						'& .MuiMenuItem-root.Mui-selected': {
							backgroundColor: `${theme.palette.secondary.main} !important`,
						},
						'& .MuiMenuItem-root.Mui-selected:hover': {
							backgroundColor: `${theme.palette.secondary.light} !important`,
						},
					},
				}}
			>
				{options.map((option, index) => (
					<MenuItem key={index} value={option.value}>
						{option.label}
					</MenuItem>
				))}
			</Select>
		</FormControl>
	);
}
