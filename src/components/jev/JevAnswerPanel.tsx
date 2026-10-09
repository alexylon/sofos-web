import { memo, ReactNode } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useThemeMode } from '@/theme/ThemeProvider';
import { grey, themeColors } from '@/theme/theme';
import { JevAnswer } from '@/types/types';

interface JevAnswerPanelProps {
	question: string;
	answer: JevAnswer;
}

interface BarRow {
	label: string;
	probability: number;
	isTop: boolean;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

function JevAnswerPanel({ question, answer }: JevAnswerPanelProps) {
	const { mode } = useThemeMode();
	const theme = useTheme();
	const surface = themeColors[mode].assistantMessage;
	// The theme's secondary text color is too faint for small text on the light panel.
	const labelInk = mode === 'dark' ? theme.palette.text.secondary : grey[750];
	const accent = theme.palette.primary.main;
	// The lightest greys with enough contrast against the panel (at least 3:1).
	const muted = mode === 'dark' ? grey[700] : grey[550];
	const track = alpha(theme.palette.text.primary, 0.08);

	const stat = (label: string, value: string) => (
		<Typography key={label}>
			<Box component="span" sx={{ color: labelInk }}>{label}</Box> {value}
		</Typography>
	);

	const bars = (rows: BarRow[]) => (
		<Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
			{rows.map((row, index) => (
				<Box component="li" key={index}>
					<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, mb: 0.5 }}>
						<Typography sx={{ fontWeight: row.isTop ? 600 : 400, overflowWrap: 'anywhere' }}>
							{row.label}
						</Typography>
						<Typography sx={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
							{percent(row.probability)}
						</Typography>
					</Box>
					<Box aria-hidden sx={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: 'hidden' }}>
						<Box sx={{
							width: percent(row.probability),
							height: '100%',
							borderRadius: 4,
							backgroundColor: row.isTop ? accent : muted,
						}} />
					</Box>
				</Box>
			))}
		</Box>
	);

	// Shows where the answer falls between a sure no and a sure yes.
	const scale = (noul: number) => (
		<Box>
			<Box aria-hidden sx={{ position: 'relative', height: 8, borderRadius: 4, backgroundColor: track }}>
				<Box sx={{
					position: 'absolute',
					left: '50%',
					top: -4,
					bottom: -4,
					width: '1px',
					backgroundColor: labelInk,
					opacity: 0.4,
				}} />
				<Box sx={{
					position: 'absolute',
					left: `${noul * 100}%`,
					top: '50%',
					width: 16,
					height: 16,
					borderRadius: '50%',
					backgroundColor: accent,
					boxShadow: `0 0 0 2px ${surface}`,
					transform: 'translate(-50%, -50%)',
				}} />
			</Box>
			<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, color: labelInk, fontSize: '0.875rem' }}>
				<span>No</span>
				<span>Yes</span>
			</Box>
		</Box>
	);

	let verdict: string;
	let stats: ReactNode;
	let figure: ReactNode;

	switch (answer.type) {
		case 'noul': {
			const isYes = answer.noul >= 0.5;
			verdict = isYes ? 'Yes' : 'No';

			stats = (
				<Typography>
					{percent(isYes ? answer.noul : 1 - answer.noul)} <Box component="span" sx={{ color: labelInk }}>likely</Box>
				</Typography>
			);

			figure = scale(answer.noul);
			break;
		}
		case 'choice': {
			const options = Object.entries(answer.probabilities).sort(([, a], [, b]) => b - a);
			verdict = answer.choice;
			stats = stat('Confidence', percent(answer.confidence));
			figure = bars(options.map(([label, probability]) => ({ label, probability, isTop: label === answer.choice })));
			break;
		}
		case 'score': {
			const levels = Object.entries(answer.legend).map(([level, label]) => ({
				label,
				probability: answer.probabilities[level] ?? 0,
			}));

			// Starts from undefined so a score with no levels doesn't throw.
			const top = levels.reduce<typeof levels[number] | undefined>(
				(best, level) => (!best || level.probability > best.probability ? level : best),
				undefined,
			);
			verdict = top?.label ?? '';

			stats = (
				<>
					{stat('Score', `${answer.score.toFixed(2)} / ${levels.length - 1}`)}
					{stat('Confidence', percent(answer.confidence))}
				</>
			);

			figure = bars(levels.map(level => ({ ...level, isTop: level === top })));
			break;
		}
	}

	return (
		<Box sx={{ backgroundColor: surface, borderRadius: `${theme.shape.borderRadius}px`, p: { xs: 2, sm: 3 } }}>
			<Typography sx={{ color: labelInk, fontSize: '0.875rem', overflowWrap: 'anywhere' }}>
				{question}
			</Typography>
			<Typography
				component="p"
				sx={{ fontSize: { xs: '2.25rem', sm: '3rem' }, fontWeight: 600, lineHeight: 1.15, mt: 1, overflowWrap: 'anywhere' }}
			>
				{verdict}
			</Typography>
			<Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, rowGap: 0.5, mt: 1 }}>
				{stats}
			</Box>
			<Box sx={{ mt: 3 }}>
				{figure}
			</Box>
		</Box>
	);
}

export default memo(JevAnswerPanel);
